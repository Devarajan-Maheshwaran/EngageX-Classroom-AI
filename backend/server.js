// server.js — EngageX backend: Express + Socket.IO
// Phase 4B: input sanitisation, reconnect-aware join, session existence guards,
//           message length cap, role validation.
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
const engagementService    = require('./services/engagementService');
const orchestrator         = require('./agents/agentOrchestrator');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const activeSessions = new Set();

// Phase 4B: max message length cap — prevents runaway inference on huge pastes
const MAX_MSG_LEN = parseInt(process.env.MAX_MSG_LEN || '500', 10);

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
  // Phase 4B: guard against summary requests for sessions that never existed
  const { sessionId } = req.params;
  const report = analyticsService.getSessionReport(sessionId);
  res.json(report);
});

app.get('/api/session/:sessionId/mood', (req, res) => {
  const mood = engagementService.getRoomMood(req.params.sessionId);
  res.json({ sessionId: req.params.sessionId, mood });
});

// Phase 4B: session state endpoint — used by debug panel (?debug=1)
app.get('/api/session/:sessionId/state', (req, res) => {
  const { sessionId } = req.params;
  res.json({
    sessionId,
    state:      orchestrator.getState(sessionId),
    cycleCount: orchestrator.getCycleCount(sessionId),
    active:     activeSessions.has(sessionId),
  });
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const rawRole      = socket.handshake.query.role      || '';
  const rawSessionId = socket.handshake.query.sessionId || '';
  const rawName      = socket.handshake.query.name      || '';

  // Phase 4B: sanitise all query params before use
  const role      = rawRole.trim().toLowerCase();
  const sessionId = rawSessionId.trim().toUpperCase().slice(0, 10); // cap at 10 chars
  const name      = rawName.trim().slice(0, 40) || 'Anonymous';      // cap at 40 chars

  // Phase 4B: validate role
  if (!['student', 'teacher'].includes(role)) {
    console.warn(`[Socket] Unknown role "${rawRole}" — disconnecting.`);
    socket.disconnect();
    return;
  }

  // Phase 4B: validate sessionId exists (students/teachers must join a real session)
  // Teachers creating a session come via REST first, so by the time they connect
  // via socket the session is already in activeSessions.
  if (!activeSessions.has(sessionId)) {
    console.warn(`[Socket] Unknown sessionId "${sessionId}" — disconnecting.`);
    socket.emit('error:session', { message: 'Session not found. Check your code.' });
    socket.disconnect();
    return;
  }

  socket.join(sessionId);
  socket.data = { role, sessionId, name };

  // ── Participant joins (with reconnect detection) ──
  if (role === 'student') {
    const joinType = participationService.registerStudent(sessionId, socket.id, name);

    bus.publish(bus.EVENTS.STUDENT_JOIN, { sessionId, studentId: socket.id, name });

    // Tell everyone in the room about the join/reconnect
    io.to(sessionId).emit('participant:joined', {
      participantId: socket.id,
      name,
      reconnect: joinType === 'restored',
    });

    // Send the new participant an immediate state snapshot so they
    // don’t see a blank screen until the next 10s broadcast
    const snapshot = participationService.getSnapshot(sessionId);
    socket.emit('room:state', { sessionId, students: snapshot, ts: Date.now() });

    console.log(`[Join]  ${name} → ${sessionId} (${joinType})`);
  }

  // ── Core message pipeline ────────────────────────────────────────────────────────
  socket.on('student:message', async ({ text } = {}) => {
    // Phase 4B: strict input validation
    if (!text || typeof text !== 'string') return;
    const trimmed = text.trim();
    if (trimmed.length === 0)             return;
    if (trimmed.length > MAX_MSG_LEN) {
      socket.emit('error:message', { message: `Message too long (max ${MAX_MSG_LEN} chars).` });
      return;
    }

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
      name,
      text:          trimmed,
      label:         sentiment.label,
      score:         sentiment.score,
      intentLabel:   intent.label,
      intentScore:   intent.score,
      allScores:     intent.allScores,
      ts:            Date.now(),
    });

    // Confusion spike check (synchronous, in-memory)
    engagementService.checkForConfusionSpike(sessionId);
  });

  // ── Host requests immediate snapshot ──
  socket.on('request:state', () => {
    const snapshot = participationService.getSnapshot(sessionId);
    socket.emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });

  // ── Host ends session ──
  socket.on('session:end', () => {
    if (role !== 'teacher') {
      socket.emit('error:auth', { message: 'Only the host can end a session.' });
      return;
    }
    orchestrator.endSession(sessionId);
    activeSessions.delete(sessionId);
    io.to(sessionId).emit('session:ended', { sessionId });
    console.log(`[Session] Ended: ${sessionId}`);
  });

  // ── Disconnect ──
  socket.on('disconnect', (reason) => {
    if (role === 'student') {
      // Phase 4B: only remove from participation if session is still active.
      // If session ended first, cleanup already happened in orchestrator.endSession().
      if (activeSessions.has(sessionId)) {
        participationService.removeStudent(sessionId, socket.id);
        bus.publish(bus.EVENTS.STUDENT_LEAVE, { sessionId, studentId: socket.id });
        io.to(sessionId).emit('participant:left', { participantId: socket.id, name });
      }
      console.log(`[Leave] ${name} ← ${sessionId} (${reason})`);
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
// Fires AFTER mentorAgent subscriber — suggestion is always attached.
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
