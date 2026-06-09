import { useRef, useState } from 'react';
import { Upload, Loader2, FileText, Rocket } from 'lucide-react';

const PYTHON_URL = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:4001';

export default function PDFQuizUploader({ sessionId, onLaunch }) {
  const fileRef  = useRef(null);
  const [loading,   setLoading]   = useState(false);
  const [questions, setQuestions] = useState([]);
  const [error,     setError]     = useState('');
  const [fileName,  setFileName]  = useState('');

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setQuestions([]);
    setError('');
  }

  async function handleExtract() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Select a PDF file first.');
      return;
    }

    setLoading(true);
    setError('');
    setQuestions([]);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('session_id', sessionId);

      const res = await fetch(`${PYTHON_URL}/api/quiz/from-pdf`, {
        method: 'POST',
        body:   form,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const list = data.questions || [];

      if (list.length === 0) {
        setError('No questions were extracted. Try a different PDF.');
        return;
      }

      setQuestions(list);
    } catch (exc) {
      setError(exc.message || 'Extraction failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* File picker */}
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 bg-white/10 border border-white/10 hover:border-white/30 rounded-lg px-3 py-2 cursor-pointer transition-colors">
          <FileText size={14} className="text-slate-400 shrink-0" />
          <span className="text-sm text-slate-400 truncate">
            {fileName || 'Choose PDF...'}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        <button
          onClick={handleExtract}
          disabled={loading || !fileName}
          className="flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {loading
            ? <Loader2 size={14} className="animate-spin" />
            : <Upload size={14} />}
          Extract
        </button>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      {/* Extracted question list */}
      {questions.length > 0 && (
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
          {questions.map((q, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-3"
            >
              <p className="text-xs text-slate-300 flex-1 leading-relaxed">
                {q.question.length > 80
                  ? `${q.question.slice(0, 80)}...`
                  : q.question}
              </p>
              <button
                onClick={() => onLaunch({ ...q, duration_s: 30 })}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
              >
                <Rocket size={11} />
                Launch
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
