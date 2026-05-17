// server.js — EngageX backend: Express + Socket.IO
// AI meeting co-pilot: host runs alongside Meet/Zoom, participants join via code.
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const { nanoid } = require('nanoid');

const bus                  = require('./services/eventBus');
const participationService = require('./services/participationService');
const sentimentService     = require('./services/sentimentService');
const classifierService    = require('./services/classifierService');
const confusionTracker     = require('./services/confusionTracker');
const analyticsService     = require('./services/analyticsService');
const orchestrator         = require('./agents/agentOrchestrator');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// Track active session IDs for the 10s room:state broadcast
const activeSessions = new Set();

// ── Warm up both AI models at boot (non-blocking) ──────────────────────────
sentimentService.loadModel().catch(console.error);
classifierService.loadModel().catch(console.error);

// ── REST ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.post('/api/session/create', (_req, res) => {
  const sessionId = nanoid(6).toUpperCase();
  orchestrator.startSession(sessionId);
  activeSessions.add(sessionId);
  console.log(`[Session] Created: ${sessionId}`);
  res.json({ sessionId });
});

app.get('/api/session/:sessionId/summary', (req, res) => {
  const report = analyticsService.getSessionReport(req.params.sessionId);
  res.json(report);
});

app.get('/api/session/:sessionId/state', (req, res) => {
  const state = orchestrator.getState(req.params.sessionId);
  res.json({ sessionId: req.params.sessionId, state });
});

// ── SOCKET.IO — single connection handler ──────────────────────────────────

io.on('connection', (socket) => {
  const { role, sessionId, name } = socket.handshake.query;

  if (!sessionId) { socket.disconnect(); return; }

  socket.join(sessionId);
  socket.data = { role, sessionId, name: name || 'Anonymous', participantId: socket.id };

  // ── Participant joins ──
  if (role === 'student') {
    participationService.registerStudent(sessionId, socket.id, name || 'Anonymous');
    bus.publish(bus.EVENTS.STUDENT_JOIN, { sessionId, studentId: socket.id, name });
    io.to(sessionId).emit('participant:joined', {
      participantId: socket.id,
      name: name || 'Anonymous',
    });
    console.log(`[Join] ${name} → ${sessionId}`);
  }

  // ── Participant sends a message: sentiment + classification pipeline ──
  socket.on('student:message', async ({ text } = {}) => {
    if (!text || typeof text !== 'string' || text.trim().length < 2) return;
    const cleanText = text.trim();

    participationService.recordMessage(sessionId, socket.id);
    bus.publish(bus.EVENTS.STUDENT_MESSAGE, { sessionId, studentId: socket.id, text: cleanText });

    // Run sentiment + classification concurrently
    const [sentiment, intent] = await Promise.allSettled([
      sentimentService.analyzeSentiment(cleanText),
      classifierService.classifyEngagement(cleanText),
    ]);

    const sentimentResult = sentiment.status === 'fulfilled' ? sentiment.value : { label: 'NEUTRAL', score: 0.5 };
    const intentResult    = intent.status    === 'fulfilled' ? intent.value    : { label: 'engaged', score: 0.5, all: {} };

    analyticsService.logSentiment(sessionId, socket.id, sentimentResult.label, sentimentResult.score);

    // Feed confusion tracker — may fire CONFUSION_SPIKE alert
    confusionTracker.record(sessionId, intentResult.label, cleanText);

    // Broadcast enriched payload to everyone in room (host sees full signal)
    io.to(sessionId).emit('sentiment:update', {
      participantId: socket.id,
      name:          socket.data.name,
      text:          cleanText,
      sentiment:     sentimentResult,
      intent:        intentResult,
      ts:            Date.now(),
    });
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

// ── 10s room:state broadcast ────────────────────────────────────────────────
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

// ── Forward agent alerts → socket room ──────────────────────────────────────
bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, (payload) => {
  // Small delay to allow mentorAgent to attach suggestion first
  setImmediate(() => {
    io.to(payload.sessionId).emit('engagement:alert', payload);
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[EngageX] Server ready on :${PORT}`);
});

module.exports = { app, io };
