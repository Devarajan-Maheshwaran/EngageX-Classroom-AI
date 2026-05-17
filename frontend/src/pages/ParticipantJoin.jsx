// ParticipantJoin.jsx — Phase 5A
// Simple join form → minimal chat UI + 4 quick reaction buttons.
// Reaction buttons send a natural-language phrase so the AI pipeline
// classifies them as real intent (not synthetic triggers).

import { useState, useRef, useEffect } from 'react';
import { useMeetingSocket } from '../hooks/useMeetingSocket';

const REACTIONS = [
  { label: 'Confused 😕',  text: "I'm really confused about this right now." },
  { label: 'Got it ✅',    text: "I understand this, it's clear to me." },
  { label: 'Excited 🚀',  text: "This is really exciting and interesting!" },
  { label: 'Lost 😴',     text: "I'm lost and not following along anymore." },
];

function JoinForm({ onJoin }) {
  const [name, setName]         = useState('');
  const [code, setCode]         = useState('');
  const [error, setError]       = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const n = name.trim();
    const c = code.trim().toUpperCase();
    if (!n) { setError('Enter your name.'); return; }
    if (c.length < 4) { setError('Enter a valid session code.'); return; }
    onJoin(c, n);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Join a session</h1>
          <p className="text-slate-400 text-sm">Enter the code your host shared</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Devarajan"
              maxLength={40}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Session code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB12CD"
              maxLength={10}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-slate-500 font-mono tracking-widest focus:outline-none focus:border-brand"
            />
          </div>
          {error && <p className="text-rose-400 text-xs">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-brand text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Join session
          </button>
        </form>
      </div>
    </div>
  );
}

function SessionRoom({ sessionId, name }) {
  const { sendMessage, sessionError, connected } = useMeetingSocket({
    role: 'student', sessionId, name,
  });

  const [text, setText]     = useState('');
  const [messages, setMsgs] = useState([]);
  const bottomRef           = useRef(null);

  function send(txt) {
    const t = txt.trim();
    if (!t) return;
    sendMessage(t);
    setMsgs((prev) => [...prev, { text: t, ts: Date.now() }]);
    setText('');
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (sessionError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400">
        <span className="text-3xl">🚫</span>
        <p className="text-white">{sessionError}</p>
        <a href="/join" className="text-brand underline text-sm">Rejoin</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-surface border-b border-border">
        <div>
          <span className="text-white font-semibold">Session </span>
          <span className="font-mono text-brand font-bold">{sessionId}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          {connected ? `Connected as ${name}` : 'Reconnecting…'}
        </div>
      </header>

      {/* Reaction quick-buttons */}
      <div className="flex gap-2 flex-wrap px-4 pt-4">
        {REACTIONS.map((r) => (
          <button
            key={r.label}
            onClick={() => send(r.text)}
            className="px-3 py-1.5 rounded-full text-sm bg-white/5 border border-border text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-slate-500 text-sm text-center mt-8">Type a message or use a reaction button above.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="self-end max-w-xs bg-brand/20 border border-brand/30 rounded-2xl rounded-br-sm px-4 py-2">
            <p className="text-sm text-white">{m.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4 pt-2 border-t border-border">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(text)}
            placeholder="Type a message…"
            maxLength={500}
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand"
          />
          <button
            onClick={() => send(text)}
            className="px-5 py-3 rounded-xl bg-brand text-white font-medium hover:opacity-90 transition-opacity"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ParticipantJoin() {
  const [joined, setJoined]       = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [name, setName]           = useState('');

  if (!joined) {
    return <JoinForm onJoin={(code, n) => { setSessionId(code); setName(n); setJoined(true); }} />;
  }
  return <SessionRoom sessionId={sessionId} name={name} />;
}
