import { useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';

const TIMER_OPTIONS = [15, 20, 30, 45, 60];
const OPTION_IDS    = ['a', 'b', 'c', 'd'];

const emptyOptions = () =>
  OPTION_IDS.reduce((acc, id) => ({ ...acc, [id]: '' }), {});

export default function QuizBuilder({ onSave }) {
  const [question, setQuestion] = useState('');
  const [options,  setOptions]  = useState(emptyOptions());
  const [correct,  setCorrect]  = useState('a');
  const [timer,    setTimer]    = useState(30);
  const [error,    setError]    = useState('');

  const optionsFilled = OPTION_IDS.every((id) => options[id].trim().length > 0);
  const canSave       = question.trim().length > 0 && optionsFilled;

  function handleOptionChange(id, value) {
    setOptions((prev) => ({ ...prev, [id]: value }));
  }

  function handleSave() {
    if (!canSave) {
      setError('Question and all four options are required.');
      return;
    }
    setError('');
    onSave({
      question:   question.trim(),
      options:    OPTION_IDS.map((id) => ({ id, text: options[id].trim() })),
      correct_id: correct,
      duration_s: timer,
    });
    handleClear();
  }

  function handleClear() {
    setQuestion('');
    setOptions(emptyOptions());
    setCorrect('a');
    setTimer(30);
    setError('');
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Question text..."
        rows={2}
        className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-amber-500"
      />

      <div className="flex flex-col gap-2">
        {OPTION_IDS.map((id) => (
          <div key={id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrect(id)}
              title="Mark as correct answer"
              className={`w-8 h-8 shrink-0 rounded-lg text-xs font-bold border transition-colors ${
                correct === id
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-white/10 border-white/10 text-slate-400 hover:border-white/30'
              }`}
            >
              {id.toUpperCase()}
            </button>
            <input
              value={options[id]}
              onChange={(e) => handleOptionChange(id, e.target.value)}
              placeholder={`Option ${id.toUpperCase()}`}
              className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 shrink-0">Timer</span>
        <select
          value={timer}
          onChange={(e) => setTimer(Number(e.target.value))}
          className="bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
        >
          {TIMER_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}s</option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex flex-1 items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          Add to Bank
        </button>
        <button
          onClick={handleClear}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-sm transition-colors"
          title="Clear form"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
