import { useMemo, useState } from 'react';
import { X, Zap, BarChart3, Loader2, Square, Play, CircleStop } from 'lucide-react';
import AlertFeed from '../AlertFeed';
import QuizModal from '../QuizModal';
import QuizBuilder from '../QuizBuilder';
import PDFQuizUploader from '../PDFQuizUploader';

const PYTHON_URL = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:4001';

const QUIZ_TABS = [
  { id: 'ai',     label: 'AI Generate' },
  { id: 'manual', label: 'Manual'      },
  { id: 'pdf',    label: 'PDF Upload'  },
];

function scoreColor(score) {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-400';
  return 'bg-red-500';
}

export default function AIInsightPanel({
  participants,
  alerts,
  roomMood,
  sessionId,
  onEndSession,
  onClose,
  quizResponseCount,
}) {
  const [topic,        setTopic]        = useState('');
  const [pendingQuiz,  setPendingQuiz]  = useState(null);
  const [quizLoading,  setQuizLoading]  = useState(false);
  const [quizError,    setQuizError]    = useState('');
  const [activeTab,    setActiveTab]    = useState('ai');

  const moodScore = useMemo(() => {
    const scores = participants
      .map((p) => p.engagementScore)
      .filter((s) => typeof s === 'number');
    if (!scores.length) return 60;
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }, [participants]);

  const moodConfig = roomMood === 'confused'
    ? { label: 'Distressed', color: 'text-red-300',     bar: 'bg-red-500'     }
    : roomMood === 'positive'
      ? { label: 'Focused',    color: 'text-emerald-300', bar: 'bg-emerald-500' }
      : { label: 'Mixed',      color: 'text-amber-300',   bar: 'bg-amber-400'   };

  async function generateQuiz(event) {
    event.preventDefault();
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;
    setQuizLoading(true);
    setQuizError('');
    try {
      const res = await fetch(`${PYTHON_URL}/api/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          topic: cleanTopic,
          context: alerts.slice(0, 5).map((a) => a.message).join('\n'),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPendingQuiz({ ...data, duration_s: 30 });
    } catch (err) {
      setQuizError(err.message || 'Could not generate quiz.');
    } finally {
      setQuizLoading(false);
    }
  }

  async function launchQuiz(quiz) {
    const res = await fetch(`${PYTHON_URL}/api/quiz/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        teacher_id: 'teacher',
        question:   quiz.question,
        quiz_type:  'mcq',
        options:    quiz.options,
        correct_id: quiz.correct_id,
        duration_s: quiz.duration_s || 30,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setPendingQuiz(null);
    setTopic('');
  }

  return (
    <aside className="w-96 h-full flex flex-col bg-black/70 backdrop-blur-md border-l border-white/10 shrink-0 relative z-20">

      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={17} className="text-amber-300" />
          <span className="text-white font-semibold text-sm">EngageX AI</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors"
          title="Close AI panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll">

        {/* Room mood */}
        <section className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Room mood</p>
            <span className={`text-xs font-semibold ${moodConfig.color}`}>{moodConfig.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full ${moodConfig.bar}`} style={{ width: `${moodScore}%` }} />
            </div>
            <span className="font-mono text-sm text-white">{moodScore}%</span>
          </div>
        </section>

        {/* Students */}
        <section className="p-4 border-b border-white/10">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Students</p>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {participants.length === 0 && (
              <p className="text-sm text-slate-500">Waiting for students to join.</p>
            )}
            {participants.map((participant) => {
              const score = participant.engagementScore ?? participant.participationScore ?? 60;
              const alertCount = alerts.filter(
                (a) => (a.studentId || a.student_id) === participant.studentId,
              ).length;
              return (
                <div key={participant.studentId} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Square
                        size={10}
                        className={
                          score >= 70 ? 'text-emerald-400'
                          : score >= 40 ? 'text-amber-300'
                          : 'text-red-400'
                        }
                        fill="currentColor"
                      />
                      <span className="text-sm text-white font-medium truncate">{participant.name}</span>
                    </div>
                    <span className="text-xs font-mono text-white">{Math.round(score)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                    <div className={`h-full ${scoreColor(score)}`} style={{ width: `${score}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 capitalize">
                    {participant.emotionLabel || 'neutral'} - {alertCount} alerts
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Agent alerts */}
        <section className="p-4 border-b border-white/10">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Agent alerts</p>
          <AlertFeed alerts={alerts} />
        </section>

        {/* Quiz section — 3 tabs */}
        <section className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-amber-300" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quiz</p>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-lg bg-white/[0.06] border border-white/10 p-0.5 mb-4">
            {QUIZ_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-amber-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* AI Generate tab */}
          {activeTab === 'ai' && (
            <form onSubmit={generateQuiz} className="flex gap-2">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic"
                className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={quizLoading || !topic.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {quizLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Generate
              </button>
            </form>
          )}
          {activeTab === 'ai' && quizError && (
            <p className="text-xs text-red-300 mt-2">{quizError}</p>
          )}

          {/* Manual tab */}
          {activeTab === 'manual' && (
            <QuizBuilder
              onSave={(q) => setPendingQuiz(q)}
            />
          )}

          {/* PDF Upload tab */}
          {activeTab === 'pdf' && (
            <PDFQuizUploader
              sessionId={sessionId}
              onLaunch={(q) => setPendingQuiz(q)}
            />
          )}
        </section>
      </div>

      {/* End session */}
      <div className="p-4 shrink-0">
        <button
          onClick={onEndSession}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white py-3 text-sm font-bold transition-colors"
        >
          <CircleStop size={16} />
          End Session
        </button>
      </div>

      <QuizModal
        quiz={pendingQuiz}
        mode="teacher"
        responseCount={quizResponseCount}
        onClose={() => setPendingQuiz(null)}
        onLaunch={launchQuiz}
      />
    </aside>
  );
}
