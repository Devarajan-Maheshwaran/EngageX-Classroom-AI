// server.js — EngageX backend: Express + Socket.IO
// Phase 3B: engagementService.checkForConfusionSpike() called after every message.
// Phase 3A: nli-deberta-v3-small classifier runs in parallel with sentiment.
// Both models warm up sequentially at startup.
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
const engagementService    = require('./services/engagementService'); // Phase 3B
const orchestrator         = require('./agents/agentOrchestrator');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const activeSessions = new Set();

// ─── STARTUP: warm up both AI models sequentially ────────────────────────────────
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

// Room mood endpoint — used by SessionHeader (Phase 5A)
app.get('/api/session/:sessionId/mood', (req, res) => {
  const mood = engagementService.getRoomMood(req.params.sessionId);
  res.json({ sessionId: req.params.sessionId, mood });
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

  if (role === 'student') {
    participationService.registerStudent(sessionId, socket.id, name || 'Anonymous');
    bus.publish(bus.EVENTS.STUDENT_JOIN, { sessionId, studentId: socket.id, name });
    io.to(sessionId).emit('participant:joined', {
      participantId: socket.id,
      name:          name || 'Anonymous',
    });
    console.log(`[Join]  ${name || 'Anonymous'} → session ${sessionId}`);
  }

  // ── Core message pipeline ────────────────────────────────────────────────────────
  // Flow per message:
  //   1. Run sentiment + classifier in parallel (Promise.allSettled)
  //   2. Update participationService record (score + lastIntentLabel)
  //   3. Log to analyticsService (sentimentLog + sliding window)
  //   4. Publish to eventBus (agents subscribe)
  //   5. Emit sentiment:update to host dashboard
  //   6. Check for confusion spike (may emit ENGAGEMENT_ALERT → mentorAgent → socket)
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

    participationService.recordMessage(sessionId, socket.id, intent.label, intent.score);

    analyticsService.logSentiment(
      sessionId, socket.id,
      sentiment.label, sentiment.score,
      intent.label, intent.score, intent.allScores
    );

    bus.publish(bus.EVENTS.STUDENT_MESSAGE, {
      sessionId,
      studentId: socket.id,
      text:      trimmed,
      sentiment,
      intent,
    });

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

    // Phase 3B: check for confusion spike after every message.
    // Synchronous check — spike detection is purely in-memory (no await needed).
    // If spike fires, mentorAgent’s bus subscriber attaches suggestion asynchronously
    // before server.js’s ENGAGEMENT_ALERT subscriber emits to the socket room.
    engagementService.checkForConfusionSpike(sessionId);
  });

  socket.on('request:state', () => {
    const snapshot = participationService.getSnapshot(sessionId);
    socket.emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });

  socket.on('session:end', () => {
    if (role !== 'teacher') return;
    orchestrator.endSession(sessionId);
    activeSessions.delete(sessionId);
    io.to(sessionId).emit('session:ended', { sessionId });
    console.log(`[Session] Ended: ${sessionId}`);
  });

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
setInterval(() => {
  activeSessions.forEach((sessionId) => {
    const snapshot = participationService.getSnapshot(sessionId);
    io.to(sessionId).emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });
}, 10000);

// ─── FORWARD AGENT ALERTS → SOCKET ROOMS ──────────────────────────────────────
// This subscriber fires AFTER mentorAgent’s subscriber has attached payload.suggestion.
// So engagement:alert always arrives at the frontend with suggestion + suggestionAI fields.
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
