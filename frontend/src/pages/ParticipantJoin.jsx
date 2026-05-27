import { useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function ParticipantJoin() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState((searchParams.get('code') || '').toUpperCase());
  const [error, setError] = useState('');
  const nameRef = useRef(null);
  const navigate = useNavigate();

  function handleJoin(event) {
    event.preventDefault();
    const name = nameRef.current.value.trim();
    const sessionCode = code.trim().toUpperCase();
    if (!name) {
      setError('Enter your name.');
      return;
    }
    if (!sessionCode) {
      setError('Enter a session code.');
      return;
    }
    navigate(`/room?sessionId=${sessionCode}&role=student&name=${encodeURIComponent(name)}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-8">
          <ArrowLeft size={14} />
          Back
        </Link>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Join a session</h1>
          <p className="text-slate-400 text-sm">Enter your name and class code</p>
        </div>
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Your name</label>
            <input
              ref={nameRef}
              placeholder="e.g. Devarajan"
              maxLength={40}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Session code</label>
            <input
              name="code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="e.g. AB12CD"
              maxLength={10}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-slate-500 font-mono tracking-widest focus:outline-none focus:border-brand"
            />
          </div>
          {error && <p className="text-rose-400 text-xs">{error}</p>}
          <button type="submit" className="w-full py-3 rounded-xl bg-brand text-white font-semibold hover:opacity-90 transition-opacity">
            Join session
          </button>
        </form>
      </div>
    </div>
  );
}
