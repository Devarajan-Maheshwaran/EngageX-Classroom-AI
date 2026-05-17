// server.js — Express + Socket.IO entry point
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const { nanoid } = require('nanoid');

const bus                  = require('./services/eventBus');
const participationService = require('./services/participationService');
const sentimentService     = require('./services/sentimentService');
const analyticsService     = require('./services/analyticsService');
const orchestrator         = require('./agents/agentOrchestrator');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Warm up model on start (non-blocking)
sentimentService.loadModel().catch(console.error);

// REST: teacher creates a session
app.post('/api/session/create', (req, res) => {
  const sessionId = nanoid(6).toUpperCase();
  orchestrator.startSession(sessionId);
  res.json({ sessionId });
});

// REST: get session report
app.get('/api/session/:sessionId/report', (req, res) => {
  const report = analyticsService.getSessionReport(req.params.sessionId);
  res.json(report);
});

// Socket.IO
io.on('connection', (socket) => {
  const { role, sessionId, name } = socket.handshake.query;

  if (!sessionId) { socket.disconnect(); return; }

  socket.join(sessionId);
  socket.data = { role, sessionId, name, studentId: socket.id };

  if (role === 'student') {
    participationService.registerStudent(sessionId, socket.id, name || 'Anonymous');
    bus.publish(bus.EVENTS.STUDENT_JOIN, { sessionId, studentId: socket.id, name });
    io.to(sessionId).emit('student:joined', { studentId: socket.id, name });
  }

  // Student sends a message
  socket.on('student:message', async (data) => {
    const { text } = data;
    participationService.recordMessage(sessionId, socket.id);
    bus.publish(bus.EVENTS.STUDENT_MESSAGE, { sessionId, studentId: socket.id, text });

    // Async sentiment (non-blocking)
    try {
      const sentiment = await sentimentService.analyzeSentiment(text);
      analyticsService.logSentiment(sessionId, socket.id, sentiment.label, sentiment.score);
      // Broadcast to teacher
      io.to(sessionId).emit('sentiment:update', {
        studentId: socket.id,
        name: socket.data.name,
        text,
        ...sentiment,
      });
    } catch (e) {
      console.error('[Sentiment]', e.message);
    }
  });

  // Teacher ends session
  socket.on('session:end', () => {
    if (role !== 'teacher') return;
    orchestrator.endSession(sessionId);
    io.to(sessionId).emit('session:ended', { sessionId });
  });

  socket.on('disconnect', () => {
    if (role === 'student') {
      participationService.removeStudent(sessionId, socket.id);
      bus.publish(bus.EVENTS.STUDENT_LEAVE, { sessionId, studentId: socket.id });
      io.to(sessionId).emit('student:left', { studentId: socket.id });
    }
  });
});

// Push room:state snapshot every 10s to teachers
setInterval(() => {
  // Collect all active sessions from orchestrator (via participationService)
  // We can't easily enumerate sessions here without a session registry;
  // teachers will receive snapshots when they send 'request:state'
}, 10000);

// Teacher-requested snapshot
io.on('connection', (socket) => {
  socket.on('request:state', () => {
    const { sessionId } = socket.data || {};
    if (!sessionId) return;
    const snapshot = participationService.getSnapshot(sessionId);
    socket.emit('room:state', { sessionId, students: snapshot, ts: Date.now() });
  });
});

// Forward engagement:alert from bus → teacher socket room
bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, (payload) => {
  io.to(payload.sessionId).emit('engagement:alert', payload);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`[EngageX] Server running on :${PORT}`));

module.exports = { app, io };
