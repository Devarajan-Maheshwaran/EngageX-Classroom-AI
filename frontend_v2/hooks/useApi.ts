/**
 * useApi.ts — Phase 4
 * Typed fetch helpers for all backend REST endpoints.
 * Centralises the base URL and error handling.
 */

'use client';

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Sessions ──────────────────────────────────────────────────────────

export interface CreateSessionPayload { title?: string; teacher_id?: string }
export interface CreateSessionResult  { id: string; join_code: string; title: string; status: string }

export interface JoinSessionPayload { join_code: string; student_name: string }
export interface JoinSessionResult  {
  session_id:   string;
  student_id:   string;
  student_name: string;
  join_code:    string;
  title:        string;
  reconnected:  boolean;
}

export interface SessionState extends CreateSessionResult {
  started_at?: string;
  ended_at?:   string;
  students:    Array<{ id: string; student_name: string; joined_at: string }>;
}

export const api = {
  sessions: {
    create: (payload: CreateSessionPayload) =>
      request<CreateSessionResult>('/api/sessions/create', {
        method: 'POST',
        body:   JSON.stringify(payload),
      }),

    join: (payload: JoinSessionPayload) =>
      request<JoinSessionResult>('/api/sessions/join', {
        method: 'POST',
        body:   JSON.stringify(payload),
      }),

    getState: (sessionId: string) =>
      request<SessionState>(`/api/sessions/${sessionId}/state`),

    start: (sessionId: string) =>
      request<{ status: string }>(`/api/sessions/${sessionId}/start`, { method: 'POST' }),

    end: (sessionId: string) =>
      request<{ status: string }>(`/api/sessions/${sessionId}/end`,   { method: 'POST' }),
  },
};
