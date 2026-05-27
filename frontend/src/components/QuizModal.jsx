import { useEffect, useState } from 'react';
import { X, Rocket, Loader2 } from 'lucide-react';

export default function QuizModal({ quiz, mode = 'student', onSubmit, onClose, onLaunch }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [draft, setDraft] = useState(quiz || null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(quiz);
  }, [quiz]);

  if (!quiz) return null;

  const options = draft?.options || [];

  async function handleLaunch() {
    setLaunching(true);
    setError('');
    try {
      await onLaunch?.(draft);
    } catch (err) {
      setError(err.message || 'Could not launch quiz.');
    } finally {
      setLaunching(false);
    }
  }

  function updateOption(index, text) {
    setDraft((prev) => ({
      ...prev,
      options: prev.options.map((option, idx) => (
        idx === index ? { ...option, text } : option
      )),
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1b1b1b] rounded-xl max-w-lg w-full shadow-2xl overflow-hidden border border-white/10">
        <div className="bg-[#241a0d] p-4 flex justify-between items-center border-b border-white/10">
          <h2 className="text-white font-bold text-lg">{mode === 'teacher' ? 'Review quiz' : 'Knowledge check'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {mode === 'teacher' ? (
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs text-slate-400 uppercase font-semibold">Question</span>
                <textarea
                  value={draft.question}
                  onChange={(event) => setDraft((prev) => ({ ...prev, question: event.target.value }))}
                  className="mt-1 w-full min-h-24 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </label>
              <div className="space-y-2">
                <span className="text-xs text-slate-400 uppercase font-semibold">Options</span>
                {options.map((option, index) => (
                  <div key={option.id || index} className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, correct_id: option.id }))}
                      className={`w-9 rounded-lg text-xs font-bold border ${draft.correct_id === option.id ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-white/10 border-white/10 text-slate-300'}`}
                      title="Mark correct"
                    >
                      {(option.id || String.fromCharCode(97 + index)).toUpperCase()}
                    </button>
                    <input
                      value={option.text ?? option}
                      onChange={(event) => updateOption(index, event.target.value)}
                      className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>
              <label className="block">
                <span className="text-xs text-slate-400 uppercase font-semibold">Duration seconds</span>
                <input
                  type="number"
                  min="10"
                  max="180"
                  value={draft.duration_s || 30}
                  onChange={(event) => setDraft((prev) => ({ ...prev, duration_s: Number(event.target.value) }))}
                  className="mt-1 w-28 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </label>
              {draft.explanation && <p className="text-xs text-slate-400">{draft.explanation}</p>}
              {error && <p className="text-xs text-red-300">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={launching}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-bold"
                >
                  {launching ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                  Launch
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-lg text-white mb-6 font-medium">{quiz.question}</p>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <button
                    key={option.id || index}
                    onClick={() => setSelectedOption(index)}
                    className={`w-full text-left p-4 rounded-lg border ${selectedOption === index ? 'bg-amber-900/40 border-amber-500 text-white' : 'bg-white/10 border-white/10 text-gray-200 hover:bg-white/15 transition-colors'}`}
                  >
                    {option.text ?? option}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => {
                    const selected = options[selectedOption];
                    onSubmit?.(selected?.id ?? String(selectedOption), selected?.text ?? selected);
                  }}
                  disabled={selectedOption === null}
                  className={`px-6 py-2 rounded-lg font-bold shadow-md transition-colors ${selectedOption !== null ? 'bg-amber-700 hover:bg-amber-800 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                >
                  Submit Answer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
