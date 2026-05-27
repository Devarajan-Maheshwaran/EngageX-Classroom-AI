// server.js — EngageX backend
// Phase 5B: /api/session/:sessionId/summary now merges participation snapshot
//           into the analytics report so the recap page has full student data.
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const { nanoid } = require('nanoid');
const { createClient } = require('@supabase/supabase-js');

const bus                  = require('./services/eventBus');
const participationService = require('./services/participationService');
const sentimentService     = require('./services/sentimentService');
const classifierService    = require('./services/classifierService');
const analyticsService     = require('./services/analyticsService');
const engagementService    = require('./services/engagementService');
const orchestrator         = require('./agents/agentOrchestrator');

const supabase = process.env.SUPABASE_URL
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function dbInsert(table, row) {
  if (!supabase) return Promise.resolve();
  return supabase.from(table).insert(row).then(({ error }) => {
    if (error) console.warn(`[Supabase] insert ${table}:`, error.message);
  });
}

function dbUpsert(table, row, conflict) {
  if (!supabase) return Promise.resolve();
  return supabase.from(table).upsert(row, { onConflict: conflict }).then(({ error }) => {
    if (error) console.warn(`[Supabase] upsert ${table}:`, error.message);
  });
}

function dbUpdate(table, match, updates) {
  if (!supabase) return Promise.resolve();
  let query = supabase.from(table).update(updates);
  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  return query.then(({ error }) => {
    if (error) console.warn(`[Supabase] update ${table}:`, error.message);
  });
}

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const activeSessions = new Set();
const MAX_MSG_LEN    = parseInt(process.env.MAX_MSG_LEN || '500', 10);

// ─── STARTUP warmup ──────────────────────────────────────────────────────────
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

// ─── REST ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.post('/api/session/create', (_req, res) => {
  const sessionId = nanoid(6).toUpperCase();
  analyticsService.initSession(sessionId);
  dbInsert('sessions', {
    id: sessionId,
    join_code: sessionId,
    title: 'Live Session',
    status: 'active',
    started_at: new Date().toISOString(),
  });
  orchestrator.startSession(sessionId);
  activeSessions.add(sessionId);
  console.log(`[Session] Created: ${sessionId}`);
  res.json({ sessionId });
});

// Phase 5B: merge participation snapshot into analytics report
app.get('/api/session/:sessionId/summary', (req, res) => {
  const { sessionId } = req.params;
  const report   = analyticsService.getSessionReport(sessionId);
  // Merge in live (or last-known) participant data
  const snapshot = participationService.getSnapshot(sessionId);
  report.students = snapshot;
  res.json(report);
});

app.get('/api/session/:sessionId/mood', (req, res) => {
  const mood = engagementService.getRoomMood(req.params.sessionId);
  res.json({ sessionId: req.params.sessionId, mood });
});

app.get('/api/session/:sessionId/state', (req, res) => {
  const { sessionId } = req.params;
  res.json({
    sessionId,
    state:      orchestrator.getState(sessionId),
    cycleCount: orchestrator.getCycleCount(sessionId),
    active:     activeSessions.has(sessionId),
  });
});

// ─── SOCKET.IO ───────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const rawRole      = socket.handshake.query.role      || '';
  const rawSessionId = socket.handshake.query.sessionId || '';
  const rawName      = socket.handshake.query.name      || '';

  const role      = rawRole.trim().toLowerCase();
  const sessionId = rawSessionId.trim().toUpperCase().slice(0, 10);
  const name      = rawName.trim().slice(0, 40) || 'Anonymous';

  if (!['student', 'teacher'].includes(role)) {
    console.warn(`[Socket] Unknown role "${rawRole}" — disconnecting.`);
    socket.disconnect();
    return;
  }

  if (!activeSessions.has(sessionId)) {
    console.warn(`[Socket] Unknown sessionId "${sessionId}" — disconnecting.`);
    socket.emit('error:session', { message: 'Session not found. Check your code.' });
    socket.disconnect();
    return;
  }

  socket.join(sessionId);
  socket.data = { role, sessionId, name };

  if (role === 'student') {
    const joinType = participationService.registerStudent(sessionId, socket.id, name);
    dbUpsert('session_students', {
      session_id: sessionId,
      student_name: name,
      socket_id: socket.id,
      joined_at: new Date().toISOString(),
      is_active: true,
    }, 'socket_id');
    bus.publish(bus.EVENTS.STUDENT_JOIN, { sessionId, studentId: socket.id, name });
    io.to(sessionId).emit('participant:joined', {
      participantId: socket.id, name, reconnect: joinType === 'restored',
    });
    const snapshot = participationService.getSnapshot(sessionId);
    socket.emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
    console.log(`[Join]  ${name} → ${sessionId} (${joinType})`);
  }

  socket.on('student:message', async ({ text } = {}) => {
    if (!text || typeof text !== 'string') return;
    const trimmed = text.trim();
    if (!trimmed.length) return;
    if (trimmed.length > MAX_MSG_LEN) {
      socket.emit('error:message', { message: `Message too long (max ${MAX_MSG_LEN} chars).` });
      return;
    }

    const [sentimentResult, intentResult] = await Promise.allSettled([
      sentimentService.analyzeSentiment(trimmed),
      classifierService.classifyIntent(trimmed),
    ]);

    const sentiment = sentimentResult.status === 'fulfilled'
      ? sentimentResult.value : { label: 'POSITIVE', score: 0.5 };
    const intent = intentResult.status === 'fulfilled'
      ? intentResult.value : { label: 'engaged', score: 0.5, allScores: {} };

    participationService.recordMessage(sessionId, socket.id, intent.label, intent.score);
    analyticsService.logSentiment(
      sessionId, socket.id,
      sentiment.label, sentiment.score,
      intent.label, intent.score, intent.allScores
    );
    const engScore = Math.round(
      (intent.label === 'confused' || intent.label === 'frustrated' ? 25 :
       intent.label === 'engaged'  || intent.label === 'excited'    ? 85 : 60) *
      (sentiment.label === 'POSITIVE' ? 1.0 : sentiment.label === 'NEGATIVE' ? 0.6 : 0.8)
    );
    dbInsert('student_signals', {
      session_id: sessionId,
      student_id: socket.id,
      signal_type: 'text',
      signal_data: {
        text: trimmed,
        sentiment: sentiment.label,
        sentimentScore: sentiment.score,
        intent: intent.label,
        intentScore: intent.score,
      },
      engagement_score: engScore,
    });
    bus.publish(bus.EVENTS.STUDENT_MESSAGE, { sessionId, studentId: socket.id, text: trimmed, sentiment, intent });
    io.to(sessionId).emit('sentiment:update', {
      participantId: socket.id, name, text: trimmed,
      label: sentiment.label, score: sentiment.score,
      intentLabel: intent.label, intentScore: intent.score, allScores: intent.allScores,
      ts: Date.now(),
    });
    engagementService.checkForConfusionSpike(sessionId);
  });

  socket.on('request:state', () => {
    const snapshot = participationService.getSnapshot(sessionId);
    socket.emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });

  socket.on('session:end', () => {
    if (role !== 'teacher') {
      socket.emit('error:auth', { message: 'Only the host can end a session.' });
      return;
    }
    orchestrator.endSession(sessionId);
    dbUpdate('sessions', { id: sessionId }, { status: 'ended', ended_at: new Date().toISOString() });
    activeSessions.delete(sessionId);
    io.to(sessionId).emit('session:ended', { sessionId });
    console.log(`[Session] Ended: ${sessionId}`);
  });

  socket.on('disconnect', (reason) => {
    if (role === 'student' && activeSessions.has(sessionId)) {
      participationService.removeStudent(sessionId, socket.id);
      dbUpdate('session_students', { socket_id: socket.id }, {
        is_active: false,
        left_at: new Date().toISOString(),
      });
      bus.publish(bus.EVENTS.STUDENT_LEAVE, { sessionId, studentId: socket.id });
      io.to(sessionId).emit('participant:left', { participantId: socket.id, name });
      console.log(`[Leave] ${name} ← ${sessionId} (${reason})`);
    }
  });
});

// ─── 10s ROOM:STATE BROADCAST ────────────────────────────────────────────────
setInterval(() => {
  activeSessions.forEach((sessionId) => {
    const snapshot = participationService.getSnapshot(sessionId);
    io.to(sessionId).emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });
}, 10000);

// ─── FORWARD AGENT ALERTS → SOCKET ROOMS ────────────────────────────────────
bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, (payload) => {
  analyticsService.logAlert(payload.sessionId, payload.type, payload.message, payload.suggestion);
  io.to(payload.sessionId).emit('engagement:alert', payload);
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`[EngageX] Server ready on :${PORT}`));

module.exports = { app, io };
