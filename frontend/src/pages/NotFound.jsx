// NotFound.jsx — Phase 6: clean 404 page with Lucide icons
import { Link } from 'react-router-dom';
import { SearchX, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-border">
        <SearchX size={30} className="text-slate-500" />
      </div>
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-slate-400 text-sm max-w-xs">
          This page doesn't exist. You may have followed a broken link or typed the wrong URL.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Home size={14} /> Go home
        </Link>
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-slate-300 text-sm font-medium hover:text-white hover:border-slate-500 transition-colors"
        >
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    </div>
  );
}
