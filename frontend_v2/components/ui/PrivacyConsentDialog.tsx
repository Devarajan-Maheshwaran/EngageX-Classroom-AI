/**
 * PrivacyConsentDialog.tsx — Phase 15
 *
 * Full-screen modal shown once before camera/microphone access.
 * Stores consent in sessionStorage so it doesn’t re-appear mid-session.
 * Accepts onAccept / onDecline callbacks.
 */

'use client';

import { useEffect, useState } from 'react';

const CONSENT_KEY = 'engagex_av_consent';

interface Props {
  onAccept:  () => void;
  onDecline: () => void;
}

export default function PrivacyConsentDialog({ onAccept, onDecline }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(CONSENT_KEY);
    if (!stored) setVisible(true);
    else if (stored === 'accepted') onAccept();
    else onDecline();
  }, []);

  function accept() {
    sessionStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
    onAccept();
  }

  function decline() {
    sessionStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
    onDecline();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7 space-y-5">

        <div className="flex items-center gap-3">
          <span className="text-3xl">🔒</span>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Privacy & data notice</h2>
            <p className="text-xs text-gray-400">EngageX v2</p>
          </div>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed">
          To measure your engagement during this session, EngageX needs access to your
          <strong> camera</strong> and <strong>microphone</strong>.
        </p>

        <ul className="text-sm text-gray-600 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Video is processed <strong>entirely in your browser</strong>. No frames are ever sent to any server.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Audio is sent as short, anonymous clips for transcription. No audio is stored permanently.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Only aggregated engagement scores are stored — never raw video or audio recordings.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            <span>You can decline and still participate. Engagement tracking will be text-only.</span>
          </li>
        </ul>

        <div className="flex gap-3 pt-1">
          <button
            onClick={decline}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Decline — text only
          </button>
          <button
            onClick={accept}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Allow camera & mic
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          This choice applies for this session only. It is stored locally in your browser.
        </p>
      </div>
    </div>
  );
}
