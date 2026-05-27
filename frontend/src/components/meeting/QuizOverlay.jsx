import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function QuizOverlay({ quiz, onSubmit, onExpire }) {
  const duration = quiz.duration_s || 30;
  const [remaining, setRemaining] = useState(duration);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setRemaining(duration);
    setSelected(null);
    setSubmitted(false);
  }, [quiz.quiz_id, duration]);

  useEffect(() => {
    if (submitted) return undefined;
    if (remaining <= 0) {
      onExpire();
      return undefined;
    }
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, submitted, onExpire]);

  const progress = Math.max(0, Math.min(100, (remaining / duration) * 100));
  const timerColor = progress > 50 ? 'bg-emerald-500' : progress > 25 ? 'bg-amber-400' : 'bg-red-500';
  const selectedOption = selected === null ? null : quiz.options?.[selected];
  const isCorrect = selectedOption?.id && quiz.correct_id ? selectedOption.id === quiz.correct_id : null;

  const result = useMemo(() => {
    if (!submitted) return null;
    if (isCorrect === true) return { Icon: CheckCircle2, text: 'Correct', color: 'text-emerald-300' };
    if (isCorrect === false) return { Icon: XCircle, text: 'Incorrect', color: 'text-red-300' };
    return { Icon: CheckCircle2, text: 'Submitted', color: 'text-amber-300' };
  }, [submitted, isCorrect]);

  function submit() {
    if (selected === null) return;
    onSubmit(selectedOption?.id ?? String(selected), selectedOption?.text ?? selectedOption);
    setSubmitted(true);
    setTimeout(onExpire, 3000);
  }

  return (
    <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-[480px] rounded-2xl bg-[#1a1209] border border-white/10 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider text-amber-300 font-bold border border-amber-500/30 rounded-full px-2 py-1">
              Quiz
            </span>
            <span className="text-xs text-slate-400">{remaining}s</span>
          </div>
          <h2 className="text-2xl font-serif text-white leading-tight">{quiz.question}</h2>
        </div>

        <div className="p-6 space-y-3">
          {quiz.options?.map((option, index) => (
            <button
              key={option.id || index}
              disabled={submitted}
              onClick={() => setSelected(index)}
              className={`w-full text-left rounded-xl border border-white/10 px-4 py-3 text-white hover:bg-amber-900/40 transition-colors ${selected === index ? 'ring-2 ring-amber-500 bg-amber-900/30' : 'bg-white/5'}`}
            >
              <span className="text-xs text-slate-400 font-bold mr-2">{(option.id || String.fromCharCode(97 + index)).toUpperCase()}</span>
              {option.text ?? option}
            </button>
          ))}

          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full ${timerColor} transition-all`} style={{ width: `${progress}%` }} />
          </div>

          {result ? (
            <div className={`flex items-center justify-center gap-2 py-3 font-bold ${result.color}`}>
              <result.Icon size={18} />
              {result.text}
            </div>
          ) : (
            <button
              onClick={submit}
              disabled={selected === null}
              className="w-full rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 transition-colors"
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
