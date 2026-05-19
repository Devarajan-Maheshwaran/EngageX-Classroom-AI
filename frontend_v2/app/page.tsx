import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      {/* Hero */}
      <div className="text-center max-w-2xl">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 text-sm font-medium px-3 py-1 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          Agentic AI · Zero Cost · Industry Standard
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-4 leading-tight">
          Engage<span className="text-brand-600">X</span>
        </h1>
        <p className="text-xl text-gray-500 mb-8">
          The AI co-pilot that reads your classroom in real time —
          detecting confusion from silence, anxiety from hesitation,
          and disengagement from deleted messages.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/host"
            className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors"
          >
            Host a Session
          </Link>
          <Link
            href="/join"
            className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors"
          >
            Join as Student
          </Link>
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 max-w-xl">
        {[
          '🧠 Multimodal signal analysis',
          '🤖 CrewAI agent ecosystem',
          '📊 Live engagement charts',
          '🗣️ Whisper transcription',
          '👁️ face-api.js vision',
          '📝 Deleted-message detection',
          '🎯 Per-student PDF reports',
        ].map((f) => (
          <span
            key={f}
            className="text-sm bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full"
          >
            {f}
          </span>
        ))}
      </div>
    </main>
  );
}
