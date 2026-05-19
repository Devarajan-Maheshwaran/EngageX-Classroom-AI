/**
 * /recap/[sessionId] — Phase 14
 *
 * Post-session recap page for teachers.
 * Shows per-student metric cards with:
 *   - avg/peak engagement badges
 *   - quiz accuracy
 *   - alert counts
 *   - Download PDF button (streams from backend)
 *   - Generate All PDFs button (batch)
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams }           from 'next/navigation';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface StudentCard {
  student_id:      string;
  student_name:    string;
  avg_engagement:  number | null;
  peak_engagement: number | null;
  alerts_count:    number;
  quiz_attempts:   number;
  quiz_correct:    number;
  quiz_accuracy:   number | null;
  pdf_url?:        string | null;
}

function EngageBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300 text-sm">—</span>;
  const color =
    score >= 65 ? 'bg-green-100 text-green-700'
    : score >= 40 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {Math.round(score)}
    </span>
  );
}

export default function RecapPage() {
  const params    = useParams();
  const sessionId = params.sessionId as string;

  const [students,       setStudents]       = useState<StudentCard[]>([]);
  const [sessionTitle,   setSessionTitle]   = useState('Session Recap');
  const [loading,        setLoading]        = useState(true);
  const [generating,     setGenerating]     = useState(false);
  const [pdfUrls,        setPdfUrls]        = useState<Record<string, string>>({});
  const [error,          setError]          = useState('');

  // Load summary report
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Try existing saved report first
        let res = await fetch(`${API}/api/report/session/${sessionId}`);
        if (!res.ok) {
          // Generate if not saved yet
          res = await fetch(`${API}/api/report/session-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          });
        }
        if (!res.ok) throw new Error('Failed to load report');
        const data = await res.json();
        const report = data.report_data ?? data;
        setSessionTitle(report.session_title ?? 'Session Recap');
        setStudents(report.students ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    if (sessionId) load();
  }, [sessionId]);

  // Load existing PDF URLs
  useEffect(() => {
    async function loadPdfUrls() {
      try {
        const res  = await fetch(`${API}/api/report/session/${sessionId}`);
        if (!res.ok) return;
        // pdf urls come from separate table; fetch via generate-pdf result if present
      } catch {}
    }
    if (sessionId) loadPdfUrls();
  }, [sessionId]);

  async function generateAllPdfs() {
    setGenerating(true); setError('');
    try {
      const res  = await fetch(`${API}/api/report/generate-pdf/${sessionId}`, { method: 'POST' });
      if (!res.ok) throw new Error('PDF generation failed');
      const data = await res.json();
      const urls: Record<string, string> = {};
      for (const r of data.reports ?? []) {
        if (r.pdf_url) urls[r.student_id] = r.pdf_url;
      }
      setPdfUrls(urls);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  }

  function streamPdfUrl(studentId: string) {
    return `${API}/api/report/pdf/${sessionId}/${studentId}`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading session recap…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold text-gray-900">EngageX</span>
          <span className="text-sm text-gray-400 ml-2">/ Recap</span>
        </div>
        <button
          onClick={generateAllPdfs}
          disabled={generating}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating PDFs…' : '📄 Generate all PDFs'}
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{sessionTitle}</h1>
        <p className="text-sm text-gray-400 mb-6">{students.length} student{students.length !== 1 ? 's' : ''}</p>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {students.map((s) => (
            <div key={s.student_id}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4"
            >
              {/* Name */}
              <div>
                <p className="font-semibold text-gray-900">{s.student_name || 'Unknown'}</p>
                <p className="text-xs text-gray-400">{s.student_id.slice(0, 8)}</p>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-400">Avg engagement</p>
                  <EngageBadge score={s.avg_engagement} />
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-400">Peak</p>
                  <EngageBadge score={s.peak_engagement} />
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-400">Alerts</p>
                  <p className={`text-sm font-bold ${
                    s.alerts_count > 2 ? 'text-red-600' : s.alerts_count > 0 ? 'text-amber-600' : 'text-gray-700'
                  }`}>{s.alerts_count}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-400">Quiz</p>
                  <p className="text-sm font-bold text-gray-700">
                    {s.quiz_attempts > 0
                      ? `${s.quiz_correct}/${s.quiz_attempts}`
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Download buttons */}
              <div className="flex gap-2">
                {pdfUrls[s.student_id] ? (
                  <a
                    href={pdfUrls[s.student_id]}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-center bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  >
                    ☁️ Download (saved)
                  </a>
                ) : (
                  <a
                    href={streamPdfUrl(s.student_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  >
                    📄 Download PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
