import { useState, useRef } from 'react';
import { useMeetingSocket } from '../hooks/useMeetingSocket';

const REACTIONS = [
  { label: '😕 Confused',  text: 'I am confused and need clarification on this.' },
  { label: '👍 Got it',    text: 'I understand this clearly, makes sense.' },
  { label: '🔥 Excited',   text: 'This is really interesting and exciting!' },
  { label: '😴 Lost',      text: 'I feel completely lost right now.' },
];

export default function ParticipantJoin() {
  const [name,      setName]      = useState('');
  const [code,      setCode]      = useState('');
  const [joined,    setJoined]    = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const inputRef = useRef(null);

  const { connected, sendMessage } = useMeetingSocket(
    joined ? { role: 'student', sessionId, name } : { role: null, sessionId: null, name: null }
  );

  function handleJoin(e) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setSessionId(code.trim().toUpperCase());
    setJoined(true);
  }

  function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage(text);
    setMessages((prev) => [...prev, { text, ts: Date.now(), type: 'out' }]);
    setInput('');
    inputRef.current?.focus();
  }

  function handleReaction(text) {
    sendMessage(text);
    setMessages((prev) => [...prev, { text, ts: Date.now(), type: 'reaction' }]);
  }

  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-1">Join a session</h1>
          <p className="text-gray-400 text-sm mb-6">Enter the code your host shared</p>
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <input
              className="bg-surface border border-surface-border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="bg-surface border border-surface-border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand uppercase tracking-widest text-center text-lg font-semibold"
              placeholder="SESSION CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
            />
            <button
              type="submit"
              className="bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition"
            >
              Join →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-bold text-lg">Session <span className="text-brand font-mono">{sessionId}</span></h1>
          <p className="text-gray-400 text-sm">Joined as <span className="text-white">{name}</span></p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${
          connected ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
          {connected ? 'Live' : 'Connecting…'}
        </div>
      </div>

      {/* Reactions */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Quick reaction</p>
        <div className="flex flex-wrap gap-2">
          {REACTIONS.map((r) => (
            <button
              key={r.label}
              onClick={() => handleReaction(r.text)}
              className="bg-surface-card border border-surface-border hover:border-brand text-sm px-3 py-1.5 rounded-lg transition"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-surface-card border border-surface-border rounded-2xl p-4 overflow-y-auto scrollbar-hide mb-4 min-h-[200px] max-h-[40vh] flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-gray-600 text-sm text-center mt-auto mb-auto">
            Your messages appear here. The host's AI sees your signals live.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.ts} className={`text-sm px-3 py-2 rounded-xl max-w-[85%] self-end ${
            m.type === 'reaction'
              ? 'bg-brand/20 text-brand border border-brand/30'
              : 'bg-surface border border-surface-border text-gray-300'
          }`}>
            {m.text}
          </div>
        ))}
      </div>

      {/* Chat input */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          ref={inputRef}
          className="flex-1 bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand"
          placeholder="Type a message or question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={!connected}
          className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white px-5 py-3 rounded-xl transition font-medium"
        >
          Send
        </button>
      </form>
    </div>
  );
}
