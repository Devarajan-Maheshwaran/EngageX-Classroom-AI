'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export default function HostPage() {
  const router = useRouter();
  const [title, setTitle]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [created, setCreated] = useState<{ join_code: string; id: string } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/sessions/create`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: title.trim() || 'Untitled Session' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const session = await res.json();
      setCreated(session);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  function handleGoToDashboard() {
    if (created) {
      // Store teacher identity in sessionStorage
      sessionStorage.setItem('engagex_role',       'teacher');
      sessionStorage.setItem('engagex_session_id', created.id);
      sessionStorage.setItem('engagex_join_code',  created.join_code);
      router.push(`/host/${created.id}`);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Host a Session</h1>
        <p className="text-gray-500 mb-8">Create a new classroom session and share the join code with students.</p>

        {!created ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session title
              </label>
              <input
                type="text"
                placeholder="e.g. Python 101 — Week 4"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
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
              {loading ? 'Creating…' : 'Create Session'}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-8">
              <p className="text-sm text-gray-500 mb-2">Share this code with students</p>
              <p className="text-6xl font-bold tracking-widest text-brand-600 font-mono">
                {created.join_code}
              </p>
            </div>
            <p className="text-sm text-gray-400">Session created successfully. Click below to open the teacher dashboard.</p>
            <button
              onClick={handleGoToDashboard}
              className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors"
            >
              Open Teacher Dashboard →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
