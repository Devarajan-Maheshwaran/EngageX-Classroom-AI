import { useEffect, useRef } from 'react';
import { Send, X } from 'lucide-react';

export default function ChatPanel({ messages, input, onInputChange, onSend, onClose }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSend();
    }
  };

  const formatMsgTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <aside className="w-[360px] h-full flex flex-col bg-[#2d2e30] border-l border-[#3c3c3c] shrink-0 relative z-20 select-none">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#3c3c3c] shrink-0">
        <span className="text-white font-semibold text-sm">In-call messages</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors"
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Info warning */}
      <div className="bg-[#202124]/40 border-b border-[#3c3c3c]/50 px-4 py-2.5 text-[10px] text-slate-400 leading-normal font-semibold">
        Messages can only be seen by people in the call and are deleted when the call ends.
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 custom-scroll">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.isLocal ? 'items-end' : 'items-start'} max-w-full`}
          >
            {/* Sender name */}
            {!m.isLocal && (
              <span className="text-[10px] font-bold text-slate-400 mb-0.5 ml-1">
                {m.senderName}
              </span>
            )}

            {/* Bubble */}
            <div
              className={`
                px-3.5 py-2 rounded-2xl max-w-[270px] shadow-sm text-sm font-medium leading-relaxed break-words
                ${m.isLocal 
                  ? 'bg-[#8a6240] text-white rounded-tr-sm' 
                  : 'bg-[#3c3f42] text-white rounded-tl-sm'
                }
              `}
            >
              <p>{m.text}</p>
              <span className="block text-[8px] text-white/60 text-right mt-1 font-bold tabular-nums leading-none">
                {formatMsgTime(m.ts)}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Bottom input area */}
      <div className="p-3 border-t border-[#3c3c3c] bg-[#2d2e30] shrink-0">
        <div className="flex gap-2 items-center">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message to everyone"
            maxLength={500}
            className="flex-1 bg-[#3c3f42] text-white text-xs font-semibold rounded-full px-4.5 py-3 placeholder-slate-500 border border-transparent focus:border-[#8a6240] focus:outline-none transition-all"
          />
          <button
            onClick={onSend}
            disabled={!input.trim()}
            className={`
              flex items-center justify-center p-2.5 rounded-full text-white shadow transition-all duration-150 shrink-0
              ${input.trim() 
                ? 'bg-[#8a6240] hover:bg-[#5c3e21]' 
                : 'bg-[#3c3f42] opacity-40 cursor-not-allowed'
              }
            `}
            title="Send message"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
