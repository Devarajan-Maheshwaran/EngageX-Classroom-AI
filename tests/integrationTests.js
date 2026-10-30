// Run with: npm test --prefix backend
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { io } = require('../backend/node_modules/socket.io-client');

const waitEvent = (socket, event, predicate = () => true) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, listener); reject(new Error(`Timed out: ${event}`)); }, 5000);
  function listener(value) { if (predicate(value)) { clearTimeout(timer); socket.off(event, listener); resolve(value); } }
  socket.on(event, listener);
});
const ack = (socket, event, value) => new Promise((resolve, reject) => socket.timeout(5000).emit(event, value, (err, response) => err ? reject(err) : resolve(response)));

test('room: host authorization, signals, quiz, duplicate response and durable recap', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'engagex-'));
  const port = 4400 + Math.floor(Math.random() * 1000);
  const base = `http://127.0.0.1:${port}`;
  let proc; const sockets = [];
  const start = () => {
    proc = spawn(process.execPath, ['server.js'], {cwd:path.join(__dirname, '../backend'), env:{...process.env, PORT:String(port), ENGAGEX_DB_PATH:path.join(dir,'test.db')}});
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Backend did not start')), 10000);
      proc.stdout.on('data', chunk => { if (String(chunk).includes('Server ready')) { clearTimeout(timer); resolve(); } });
      proc.on('exit', code => { clearTimeout(timer); if (code) reject(new Error(`backend exit ${code}`)); });
    });
  };
  const stop = () => new Promise(resolve => { if (proc.exitCode !== null) return resolve(); proc.once('exit', resolve); proc.kill(); });
  try {
    await start();
    const created = await (await fetch(`${base}/api/session/create`, {method:'POST'})).json();
    const connect = (role, auth) => { const s = io(base, {query:{role,sessionId:created.sessionId,name:role}, auth, reconnection:false}); sockets.push(s); return s; };
    const bad = connect('teacher', {}); const authError = waitEvent(bad, 'error:auth'); assert.match((await authError).message, /credential/i);
    const host = connect('teacher', {hostToken:created.hostToken}); await waitEvent(host, 'connect');
    const student = connect('student', {participantId:'student_123456'}); await waitEvent(student, 'connect');
    const joined = waitEvent(host, 'room:state', x => x.students.some(p => p.studentId === 'student_123456'));
    host.emit('request:state'); await joined;
    const alert = waitEvent(host, 'engagement:alert', x => x.type === 'CONFUSION_SPIKE');
    for (let i=0; i<3; i++) { const seen = waitEvent(host, 'sentiment:update'); student.emit('student:message', {text:'I am confused about this'}); await seen; }
    assert.equal((await alert).type, 'CONFUSION_SPIKE');
    let extraAlerts = 0; const countExtra = a => { if (a.type === 'CONFUSION_SPIKE') extraAlerts++; };
    host.on('engagement:alert', countExtra);
    const extraMessage = waitEvent(host, 'sentiment:update'); student.emit('student:message', {text:'Still confused'}); await extraMessage;
    await new Promise(resolve => setTimeout(resolve, 50)); host.off('engagement:alert', countExtra);
    assert.equal(extraAlerts, 0, 'confusion cooldown suppresses repeat alerts');
    const quizStart = waitEvent(student, 'quiz_start');
    const launched = await ack(host, 'quiz:launch', {question:'2 + 2?', options:[{id:'a',text:'4'},{id:'b',text:'5'}], correct_id:'a',duration_s:30});
    const publicQuiz = await quizStart; assert.equal(publicQuiz.quiz_id, launched.quizId); assert.equal(publicQuiz.correct_id, undefined);
    const board = waitEvent(host, 'leaderboard:update', x => x.length > 0);
    assert.equal((await ack(student, 'student:quiz_response', {quizId:launched.quizId,answerId:'a'})).ok, true);
    assert.equal((await board)[0].score, 1);
    assert.match((await ack(student, 'student:quiz_response', {quizId:launched.quizId,answerId:'a'})).error, /Already/);
    const ended = waitEvent(host, 'session:ended'); host.emit('session:end'); await ended;
    const recap = await (await fetch(`${base}/api/session/${created.sessionId}/summary`)).json();
    assert.equal(recap.totalMessages, 4); assert.equal(recap.students.length, 1); assert.equal(recap.leaderboard[0].score, 1);
    sockets.forEach(s => s.disconnect()); await stop(); await start();
    const afterRestart = await (await fetch(`${base}/api/session/${created.sessionId}/summary`)).json();
    assert.equal(afterRestart.totalMessages, 4); assert.equal(afterRestart.leaderboard[0].score, 1);
  } finally { sockets.forEach(s => s.disconnect()); if (proc) await stop(); rmSync(dir, {recursive:true,force:true}); }
});
