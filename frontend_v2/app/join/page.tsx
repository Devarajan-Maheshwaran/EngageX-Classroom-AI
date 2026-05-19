'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export default function JoinPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [name, setName]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim() || !name.trim()) {
      setError('Both name and join code are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/sessions/join`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          join_code:    joinCode.trim().toUpperCase(),
          student_name: name.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail ?? 'Failed to join session');
      }
      const data = await res.json();

      // Persist identity for session page
      sessionStorage.setItem('engagex_role',        'student');
      sessionStorage.setItem('engagex_student_id',  data.student_id);
      sessionStorage.setItem('engagex_student_name', data.student_name);
      sessionStorage.setItem('engagex_session_id',  data.session_id);

      router.push(`/session/${data.session_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Join a Session</h1>
        <p className="text-gray-500 mb-8">Enter the join code your teacher shared and your name.</p>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Join code</label>
            <input
              type="text"
              placeholder="e.g. AB12CD"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono uppercase tracking-widest text-center text-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
            <input
              type="text"
              placeholder="e.g. Devarajan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Joining…' : 'Join Session'}
          </button>
        </form>
      </div>
    </main>
  );
}
