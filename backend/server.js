// server.js — EngageX backend: Express + Socket.IO
// Phase 3A: nli-deberta-v3-small classifier runs in parallel with sentiment on every message.
// Both models warm up sequentially at startup so first message is never slow.
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const { nanoid } = require('nanoid');

const bus                  = require('./services/eventBus');
const participationService = require('./services/participationService');
const sentimentService     = require('./services/sentimentService');
const classifierService    = require('./services/classifierService');
const analyticsService     = require('./services/analyticsService');
const orchestrator         = require('./agents/agentOrchestrator');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// Active session registry — used for 10s room:state broadcast
const activeSessions = new Set();

// ─── STARTUP: warm up both models sequentially ───────────────────────────────
// Sequential (not parallel) to avoid RAM spike when both models download
// simultaneously on Railway first boot. By the time the first participant
// sends a message, both pipelines are warm and inference is fast.
(async () => {
  try {
    await sentimentService.loadModel();
    await classifierService.loadModel();
    console.log('[EngageX] All AI models ready.');
  } catch (err) {
    console.error('[EngageX] Model warm-up error:', err.message);
    console.warn('[EngageX] Models will load lazily on first use.');
  }
})();

// ─── REST ─────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.post('/api/session/create', (_req, res) => {
  const sessionId = nanoid(6).toUpperCase();
  analyticsService.initSession(sessionId);
  orchestrator.startSession(sessionId);
  activeSessions.add(sessionId);
  console.log(`[Session] Created: ${sessionId}`);
  res.json({ sessionId });
});

app.get('/api/session/:sessionId/summary', (req, res) => {
  const report = analyticsService.getSessionReport(req.params.sessionId);
  res.json(report);
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const { role, sessionId, name } = socket.handshake.query;

  if (!sessionId) {
    socket.disconnect();
    return;
  }

  socket.join(sessionId);
  socket.data = { role, sessionId, name: name || 'Anonymous' };

  // ── Participant joins ──
  if (role === 'student') {
    participationService.registerStudent(sessionId, socket.id, name || 'Anonymous');
    bus.publish(bus.EVENTS.STUDENT_JOIN, { sessionId, studentId: socket.id, name });
    io.to(sessionId).emit('participant:joined', {
      participantId: socket.id,
      name:          name || 'Anonymous',
    });
    console.log(`[Join]  ${name || 'Anonymous'} → session ${sessionId}`);
  }

  // ── Participant sends a message ──
  // Both models run via Promise.allSettled — if one fails, the other still
  // completes and the session is never interrupted.
  socket.on('student:message', async ({ text } = {}) => {
    if (!text || typeof text !== 'string' || text.trim().length === 0) return;
    const trimmed = text.trim();

    const [sentimentResult, intentResult] = await Promise.allSettled([
      sentimentService.analyzeSentiment(trimmed),
      classifierService.classifyIntent(trimmed),
    ]);

    const sentiment = sentimentResult.status === 'fulfilled'
      ? sentimentResult.value
      : { label: 'POSITIVE', score: 0.5 };

    const intent = intentResult.status === 'fulfilled'
      ? intentResult.value
      : { label: 'engaged', score: 0.5, allScores: {} };

    // Update participation record with latest intent label
    participationService.recordMessage(sessionId, socket.id, intent.label, intent.score);

    // Log enriched entry — updates sentimentLog + sliding window
    analyticsService.logSentiment(
      sessionId, socket.id,
      sentiment.label, sentiment.score,
      intent.label, intent.score, intent.allScores
    );

    // Publish to eventBus for agents (monitorAgent, balancerAgent, engagementService Phase 3B)
    bus.publish(bus.EVENTS.STUDENT_MESSAGE, {
      sessionId,
      studentId: socket.id,
      text:      trimmed,
      sentiment,
      intent,
    });

    // Broadcast enriched update to host dashboard
    // intentLabel + allScores let the frontend show live mood badges (Phase 5A)
    io.to(sessionId).emit('sentiment:update', {
      participantId: socket.id,
      name:          socket.data.name,
      text:          trimmed,
      label:         sentiment.label,
      score:         sentiment.score,
      intentLabel:   intent.label,
      intentScore:   intent.score,
      allScores:     intent.allScores,
      ts:            Date.now(),
    });
  });

  // ── Host requests immediate snapshot ──
  socket.on('request:state', () => {
    const snapshot = participationService.getSnapshot(sessionId);
    socket.emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });

  // ── Host ends session ──
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
      console.log(`[Leave] ${socket.data.name} ← session ${sessionId}`);
    }
  });
});

// ─── 10s ROOM:STATE BROADCAST ─────────────────────────────────────────────────
// Snapshot now includes lastIntentLabel per participant (Phase 3A).
// Host dashboard tiles update without needing to poll REST.
setInterval(() => {
  activeSessions.forEach((sessionId) => {
    const snapshot = participationService.getSnapshot(sessionId);
    io.to(sessionId).emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });
}, 10000);

// ─── FORWARD AGENT ALERTS → SOCKET ROOMS ──────────────────────────────────────
bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, (payload) => {
  analyticsService.logAlert(
    payload.sessionId,
    payload.type,
    payload.message,
    payload.suggestion
  );
  io.to(payload.sessionId).emit('engagement:alert', payload);
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[EngageX] Server ready on :${PORT}`);
});

module.exports = { app, io };
