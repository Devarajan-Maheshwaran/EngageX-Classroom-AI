// server.js — EngageX backend: Express + Socket.IO
// Acts as a meeting AI co-pilot — host opens EngageX alongside Meet/Zoom,
// participants join via a short code and send chat signals.
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const { nanoid } = require('nanoid');

const bus                  = require('./services/eventBus');
const participationService = require('./services/participationService');
const sentimentService     = require('./services/sentimentService');
const analyticsService     = require('./services/analyticsService');
const orchestrator         = require('./agents/agentOrchestrator');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// Track active session IDs for the 10s broadcast loop
const activeSessions = new Set();

// Warm up AI model at boot (non-blocking — model ready before first message)
sentimentService.loadModel().catch(console.error);

// ─── REST ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Host creates a new session → returns 6-char code
app.post('/api/session/create', (_req, res) => {
  const sessionId = nanoid(6).toUpperCase();
  orchestrator.startSession(sessionId);
  activeSessions.add(sessionId);
  console.log(`[Session] Created: ${sessionId}`);
  res.json({ sessionId });
});

// Full session report (JSON — used by frontend summary drawer)
app.get('/api/session/:sessionId/summary', (req, res) => {
  const report = analyticsService.getSessionReport(req.params.sessionId);
  res.json(report);
});

// ─── SOCKET.IO — single connection handler ────────────────────────────────────

io.on('connection', (socket) => {
  const { role, sessionId, name } = socket.handshake.query;

  // Guard: every socket must carry a valid sessionId
  if (!sessionId) {
    socket.disconnect();
    return;
  }

  socket.join(sessionId);
  socket.data = { role, sessionId, name: name || 'Anonymous', participantId: socket.id };

  // ── Participant joins ──
  if (role === 'student') {
    participationService.registerStudent(sessionId, socket.id, name || 'Anonymous');
    bus.publish(bus.EVENTS.STUDENT_JOIN, { sessionId, studentId: socket.id, name });
    // Notify everyone in the room (host sees the new tile immediately)
    io.to(sessionId).emit('participant:joined', {
      participantId: socket.id,
      name: name || 'Anonymous',
    });
    console.log(`[Join] ${name} → ${sessionId}`);
  }

  // ── Participant sends a chat message ──
  socket.on('student:message', async ({ text } = {}) => {
    if (!text || typeof text !== 'string') return;
    participationService.recordMessage(sessionId, socket.id);
    bus.publish(bus.EVENTS.STUDENT_MESSAGE, { sessionId, studentId: socket.id, text });

    try {
      const sentiment = await sentimentService.analyzeSentiment(text);
      analyticsService.logSentiment(sessionId, socket.id, sentiment.label, sentiment.score);
      io.to(sessionId).emit('sentiment:update', {
        participantId: socket.id,
        name: socket.data.name,
        text,
        label: sentiment.label,
        score: sentiment.score,
        ts: Date.now(),
      });
    } catch (err) {
      console.error('[Sentiment error]', err.message);
    }
  });

  // ── Host requests immediate snapshot ──
  socket.on('request:state', () => {
    const snapshot = participationService.getSnapshot(sessionId);
    socket.emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });

  // ── Host ends the session ──
  socket.on('session:end', () => {
    if (role !== 'teacher') return;
    orchestrator.endSession(sessionId);
    activeSessions.delete(sessionId);
    io.to(sessionId).emit('session:ended', { sessionId });
    console.log(`[Session] Ended: ${sessionId}`);
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    if (role === 'student') {
      participationService.removeStudent(sessionId, socket.id);
      bus.publish(bus.EVENTS.STUDENT_LEAVE, { sessionId, studentId: socket.id });
      io.to(sessionId).emit('participant:left', { participantId: socket.id });
    }
  });
});

// ─── 10s ROOM:STATE BROADCAST ─────────────────────────────────────────────────
// Host dashboard relies on this; no need for polling REST endpoints
setInterval(() => {
  activeSessions.forEach((sessionId) => {
    const snapshot = participationService.getSnapshot(sessionId);
    io.to(sessionId).emit('room:state', {
      sessionId,
      students: snapshot,
      ts: Date.now(),
    });
  });
}, 10000);

// ─── FORWARD AGENT ALERTS → SOCKET ROOM ──────────────────────────────────────
bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, (payload) => {
  io.to(payload.sessionId).emit('engagement:alert', payload);
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[EngageX] Server ready on :${PORT}`);
});

module.exports = { app, io };
