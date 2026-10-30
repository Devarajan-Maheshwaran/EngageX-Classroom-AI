const express    = require('express');
const http       = require('http');
const path       = require('path');
const fs         = require('fs');
const { Server } = require('socket.io');
const cors       = require('cors');
const { nanoid } = require('nanoid');
const crypto = require('crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const nodeStore  = require('./db/nodeStore');

const bus                  = require('./services/eventBus');
const participationService = require('./services/participationService');
const sentimentService     = require('./services/sentimentService');
const classifierService    = require('./services/classifierService');
const analyticsService     = require('./services/analyticsService');
const engagementService    = require('./services/engagementService');
const orchestrator         = require('./agents/agentOrchestrator');

const app    = express();
const server = http.createServer(app);

// ─── CORS ────────────────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === 'production';

const corsOrigin = IS_PROD
  ? [
      process.env.FRONTEND_URL,
      /\.loca\.lt$/,
      /\.vercel\.app$/,
    ].filter(Boolean)
  : true;

app.use(cors({ origin: corsOrigin, credentials: true }));
// Keep browser-facing Python requests same-origin when the built app is served here.
// Proxy before express.json so request bodies (including PDF uploads) remain intact.
app.use('/python', (req, res) => {
  const upstream = http.request({
    hostname: process.env.PYTHON_HOST || '127.0.0.1',
    port: Number(process.env.PYTHON_PORT || 4001),
    method: req.method,
    path: req.url,
    headers: { ...req.headers, host: `${process.env.PYTHON_HOST || '127.0.0.1'}:${process.env.PYTHON_PORT || 4001}` },
  }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.status(502).json({ error: 'Optional Python service is unavailable.' });
    else res.destroy();
  });
  req.pipe(upstream);
});
app.use(express.json());

// ─── SOCKET.IO ───────────────────────────────────────────────────────────────

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingTimeout:  60000,
  pingInterval: 25000,
});

// ─── STATE ───────────────────────────────────────────────────────────────────

const activeSessions = new Set();
const MAX_MSG_LEN    = parseInt(process.env.MAX_MSG_LEN || '500', 10);

// In-memory quiz response counters: { [quizId]: { count, total } }
const quizResponseCounts = {};

function leaderboard(sessionId) {
  return nodeStore.getDb().prepare(`SELECT r.student_id AS studentId, COALESCE(s.display_name, r.student_id) AS name,
    SUM(r.is_correct) AS score, COUNT(*) AS answered
    FROM quiz_responses r LEFT JOIN students s ON s.id = r.student_id
    WHERE r.session_id = ? GROUP BY r.student_id ORDER BY score DESC, MIN(r.ts) ASC`).all(sessionId);
}

// ─── STARTUP WARMUP ──────────────────────────────────────────────────────────

(async () => {
  if (process.env.ENABLE_LOCAL_MODELS !== 'true') return;
  try {
    await sentimentService.loadModel();
    await classifierService.loadModel();
    console.log('[EngageX] AI models ready.');
  } catch (err) {
    console.error('[EngageX] Model warm-up error:', err.message);
    console.warn('[EngageX] Models will load lazily on first use.');
  }
})();

// ─── REST ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.post('/api/session/create', (_req, res) => {
  const sessionId = nanoid(6).toUpperCase();
  const hostToken = nanoid(32);
  analyticsService.initSession(sessionId);
  nodeStore.insertSession({
    id:         sessionId,
    join_code:  sessionId,
    title:      'Live Session',
    status:     'active',
    started_at: new Date().toISOString(),
  });
  nodeStore.getDb().prepare('INSERT INTO demo_sessions (session_id, host_token_hash) VALUES (?, ?)').run(sessionId, hash(hostToken));
  orchestrator.startSession(sessionId);
  activeSessions.add(sessionId);
  console.log(`[Session] Created: ${sessionId}`);
  res.json({ sessionId, hostToken });
});

app.get('/api/session/:sessionId/summary', (req, res) => {
  const { sessionId } = req.params;
  const saved = nodeStore.getDb().prepare('SELECT recap_json FROM demo_sessions WHERE session_id = ?').get(sessionId);
  if (saved?.recap_json) return res.json(JSON.parse(saved.recap_json));
  const report   = analyticsService.getSessionReport(sessionId);
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

// ─── SOCKET CONNECTIONS ──────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const rawRole      = socket.handshake.query.role      || '';
  const rawSessionId = socket.handshake.query.sessionId || '';
  const rawName      = socket.handshake.query.name      || '';

  const role      = rawRole.trim().toLowerCase();
  const sessionId = rawSessionId.trim().toUpperCase().slice(0, 10);
  const name      = rawName.trim().slice(0, 40) || 'Anonymous';
  const token = typeof socket.handshake.auth?.hostToken === 'string' ? socket.handshake.auth.hostToken : '';
  const participantId = typeof socket.handshake.auth?.participantId === 'string' && /^[a-zA-Z0-9_-]{10,64}$/.test(socket.handshake.auth.participantId) ? socket.handshake.auth.participantId : socket.id;

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

  if (role === 'teacher') {
    const row = nodeStore.getDb().prepare('SELECT host_token_hash FROM demo_sessions WHERE session_id = ?').get(sessionId);
    if (!row || hash(token) !== row.host_token_hash) { socket.emit('error:auth', {message: 'Invalid host credential.'}); socket.disconnect(); return; }
  }
  socket.join(sessionId);
  socket.data = { role, sessionId, name, participantId };
  socket.emit('leaderboard:update', leaderboard(sessionId));
  const recentQuiz = nodeStore.getDb().prepare('SELECT id, payload_json FROM quizzes WHERE session_id = ? ORDER BY rowid DESC LIMIT 1').get(sessionId);
  if (recentQuiz && role === 'student') {
    const q = JSON.parse(recentQuiz.payload_json);
    const answered = nodeStore.getDb().prepare('SELECT 1 FROM quiz_responses WHERE quiz_id = ? AND student_id = ?').get(recentQuiz.id, participantId);
    if (q.endsAt > Date.now() && !answered) socket.emit('quiz_start', {quiz_id: recentQuiz.id, question:q.question, options:q.options, duration_s:Math.ceil((q.endsAt-Date.now())/1000), endsAt:q.endsAt});
  }

  if (role === 'student') {
    const joinType = participationService.registerStudent(sessionId, participantId, name);
    nodeStore.upsertSessionStudent({
      session_id:  sessionId,
      student_name: name,
      socket_id:   participantId,
      joined_at:   new Date().toISOString(),
    });
    bus.publish(bus.EVENTS.STUDENT_JOIN, { sessionId, studentId: participantId, name });
    io.to(sessionId).emit('participant:joined', {
      participantId: participantId,
      name,
      reconnect: joinType === 'restored',
    });
    const snapshot = participationService.getSnapshot(sessionId);
    socket.emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
    console.log(`[Join]  ${name} -> ${sessionId} (${joinType})`);
  }

  // ── Text messages ──────────────────────────────────────────────────────────

  socket.on('student:message', async ({ text } = {}) => {
    if (role !== 'student' || !activeSessions.has(sessionId) || !text || typeof text !== 'string') return;
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
      ? sentimentResult.value
      : { label: 'POSITIVE', score: 0.5 };
    const intent = intentResult.status === 'fulfilled'
      ? intentResult.value
      : { label: 'engaged', score: 0.5, allScores: {} };

    participationService.recordMessage(sessionId, participantId, intent.label, intent.score);
    analyticsService.logSentiment(
      sessionId, participantId,
      sentiment.label, sentiment.score,
      intent.label, intent.score, intent.allScores,
    );

    const engScore = Math.round(
      (intent.label === 'confused' || intent.label === 'frustrated' ? 25 :
       intent.label === 'engaged'  || intent.label === 'excited'    ? 85 : 60) *
      (sentiment.label === 'POSITIVE' ? 1.0 : sentiment.label === 'NEGATIVE' ? 0.6 : 0.8),
    );

    nodeStore.logTextSignal({
      session_id:       sessionId,
      student_id:       participantId,
      ts:               new Date().toISOString(),
      text:             trimmed,
      sentiment_label:  sentiment.label,
      sentiment_score:  sentiment.score,
      intent_label:     intent.label,
      intent_score:     intent.score,
      engagement_score: engScore,
    });

    bus.publish(bus.EVENTS.STUDENT_MESSAGE, {
      sessionId, studentId: participantId, text: trimmed, sentiment, intent,
    });

    io.to(sessionId).emit('sentiment:update', {
      participantId: participantId,
      name,
      text:         trimmed,
      label:        sentiment.label,
      score:        sentiment.score,
      intentLabel:  intent.label,
      intentScore:  intent.score,
      allScores:    intent.allScores,
      ts:           Date.now(),
    });

    engagementService.checkForConfusionSpike(sessionId);
  });

  // ── Quiz responses ─────────────────────────────────────────────────────────

  socket.on('quiz:launch', (quiz, ack = () => {}) => {
    if (role !== 'teacher' || !activeSessions.has(sessionId)) return ack({error: 'Not authorized'});
    if (!quiz || typeof quiz.question !== 'string' || !quiz.question.trim() || !Array.isArray(quiz.options) || quiz.options.length < 2 || quiz.options.length > 6 || quiz.options.some(o => !o || typeof o.id !== 'string' || typeof o.text !== 'string' || !o.text.trim()) || new Set(quiz.options.map(o => o.id)).size !== quiz.options.length || !quiz.options.some(o => o.id === quiz.correct_id)) return ack({error: 'Invalid quiz'});
    const lastQuiz = nodeStore.getDb().prepare('SELECT payload_json FROM quizzes WHERE session_id = ? ORDER BY rowid DESC LIMIT 1').get(sessionId);
    if (lastQuiz && JSON.parse(lastQuiz.payload_json).endsAt > Date.now()) return ack({error:'A quiz is already running'});
    const duration = Math.max(10, Math.min(300, Number(quiz.duration_s) || 30));
    const quizId = nanoid();
    const payload = {question: quiz.question.slice(0, 500), options: quiz.options.map(o => ({id:o.id, text:o.text.slice(0,300)})), correct_id:quiz.correct_id, duration_s:duration, endsAt:Date.now()+duration*1000};
    nodeStore.getDb().prepare('INSERT INTO quizzes (id, session_id, topic, payload_json, created_at) VALUES (?, ?, ?, ?, ?)').run(quizId, sessionId, payload.question, JSON.stringify(payload), new Date().toISOString());
    const publicQuiz = {quiz_id:quizId, question:payload.question, options:payload.options, duration_s:duration, endsAt:payload.endsAt};
    io.to(sessionId).emit('quiz_start', publicQuiz);
    setTimeout(() => io.to(sessionId).emit('quiz:ended', {quizId, correct_id:payload.correct_id, leaderboard:leaderboard(sessionId)}), duration*1000).unref();
    ack({quizId});
  });

  socket.on('student:quiz_response', ({ quizId, answerId } = {}, ack = () => {}) => {
    if (role !== 'student' || !activeSessions.has(sessionId)) return ack({error:'Not authorized'});
    const db = nodeStore.getDb();
    const row = db.prepare('SELECT * FROM quizzes WHERE id = ? AND session_id = ?').get(quizId, sessionId);
    if (!row) return ack({error:'Quiz not found'});
    const quiz = JSON.parse(row.payload_json);
    if (Date.now() > quiz.endsAt) return ack({error:'Quiz has ended'});
    if (!quiz.options.some(o => o.id === answerId)) return ack({error:'Invalid answer'});
    if (db.prepare('SELECT 1 FROM quiz_responses WHERE quiz_id = ? AND student_id = ?').get(quizId, participantId)) return ack({error:'Already answered'});
    db.prepare('INSERT INTO quiz_responses (quiz_id,session_id,student_id,ts,answer_id,is_correct) VALUES (?,?,?,?,?,?)').run(quizId,sessionId,participantId,new Date().toISOString(),answerId,Number(answerId === quiz.correct_id));
    const board = leaderboard(sessionId);
    io.to(sessionId).emit('leaderboard:update', board);
    ack({ok:true});
  });

  // ── Utility ────────────────────────────────────────────────────────────────

  socket.on('request:state', () => {
    const snapshot = participationService.getSnapshot(sessionId);
    socket.emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });

  socket.on('session:end', () => {
    if (role !== 'teacher') {
      socket.emit('error:auth', { message: 'Only the host can end a session.' });
      return;
    }
    const report = analyticsService.getSessionReport(sessionId);
    const liveStudents = participationService.getSnapshot(sessionId);
    report.students = nodeStore.getDb().prepare(`SELECT ss.student_id AS studentId, s.display_name AS name, ss.joined_at AS joinedAt, ss.left_at AS leftAt
      FROM session_students ss LEFT JOIN students s ON s.id = ss.student_id WHERE ss.session_id = ?`).all(sessionId).map(student => {
        const messages = report.sentimentLog.filter(entry => entry.studentId === student.studentId);
        return { ...student, messageCount: messages.length, lastIntentLabel: messages.at(-1)?.intentLabel || null, ...liveStudents.find(p => p.studentId === student.studentId) };
      });
    report.leaderboard = leaderboard(sessionId);
    report.endedAt = Date.now();
    nodeStore.getDb().prepare('UPDATE demo_sessions SET recap_json = ? WHERE session_id = ?').run(JSON.stringify(report), sessionId);
    orchestrator.endSession(sessionId);
    nodeStore.endSession(sessionId, new Date().toISOString());
    activeSessions.delete(sessionId);
    io.to(sessionId).emit('session:ended', { sessionId });
    console.log(`[Session] Ended: ${sessionId}`);
  });

  socket.on('disconnect', (reason) => {
    if (role === 'student' && activeSessions.has(sessionId)) {
      participationService.removeStudent(sessionId, participantId);
      nodeStore.removeSessionStudent(sessionId, participantId, new Date().toISOString());
      bus.publish(bus.EVENTS.STUDENT_LEAVE, { sessionId, studentId: participantId });
      io.to(sessionId).emit('participant:left', { participantId: participantId, name });
      console.log(`[Leave] ${name} <- ${sessionId} (${reason})`);
    }
  });
});

// ─── PERIODIC ROOM STATE BROADCAST ──────────────────────────────────────────

setInterval(() => {
  activeSessions.forEach((sessionId) => {
    const snapshot = participationService.getSnapshot(sessionId);
    io.to(sessionId).emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });
}, 10_000);

// ─── AGENT ALERT FORWARDING ──────────────────────────────────────────────────

bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, (payload) => {
  analyticsService.logAlert(
    payload.sessionId, payload.type, payload.message, payload.suggestion,
  );
  io.to(payload.sessionId).emit('engagement:alert', payload);
});

// Serve the optional frontend build on the same origin as the API and socket.
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/python/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── START ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '4000', 10);
server.listen(PORT, () => console.log(`[EngageX] Server ready on :${PORT}`));

module.exports = { app, io };
