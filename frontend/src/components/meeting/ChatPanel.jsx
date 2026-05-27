import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';

const INTENT_CLASS = {
  engaged: 'bg-emerald-500/15 border-emerald-500/25',
  excited: 'bg-emerald-500/15 border-emerald-500/25',
  confused: 'bg-amber-500/15 border-amber-500/25',
  frustrated: 'bg-red-500/15 border-red-500/25',
  bored: 'bg-slate-500/15 border-slate-500/25',
};

export default function ChatPanel({ sentiments = [], onSend, onClose }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sentiments]);

  function submit() {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  }

  return (
    <aside className="w-[360px] h-full flex flex-col bg-[#1b1b1b] border-l border-white/10 shrink-0 relative z-20 select-none">
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
        <span className="text-white font-semibold text-sm">In-call messages</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors" title="Close panel">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scroll">
        {sentiments.length === 0 && (
          <p className="text-slate-500 text-sm text-center mt-8">No messages yet.</p>
        )}
        {sentiments.map((message, index) => (
          <div key={`${message.ts || index}-${message.participantId || index}`} className={`rounded-xl border px-3.5 py-2 text-sm text-white ${INTENT_CLASS[message.intentLabel] || 'bg-white/10 border-white/10'}`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-slate-300 truncate">{message.name || 'Participant'}</span>
              <span className="text-[10px] text-slate-500 capitalize">{message.intentLabel || message.label || 'neutral'}</span>
            </div>
            <p className="leading-relaxed break-words">{message.text}</p>
            <span className="block text-[10px] text-slate-500 mt-1">
              {message.ts ? new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-white/10 bg-[#1b1b1b] shrink-0">
        <div className="flex gap-2 items-center">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
            placeholder="Send a message"
            maxLength={500}
            className="flex-1 bg-white/10 text-white text-xs font-semibold rounded-xl px-4 py-3 placeholder-slate-500 border border-white/10 focus:border-amber-500 focus:outline-none transition-all"
          />
          <button
            onClick={submit}
            disabled={!input.trim()}
            className={`flex items-center justify-center p-3 rounded-xl text-white transition-colors shrink-0 ${input.trim() ? 'bg-amber-700 hover:bg-amber-800' : 'bg-white/10 opacity-40 cursor-not-allowed'}`}
            title="Send message"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
