/**
 * socket.ts — Phase 4
 * Singleton Socket.IO client.
 * Import getSocket() anywhere; it returns the same instance.
 */

import { io, Socket } from 'socket.io-client';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io(BACKEND_URL, {
      path:              '/socket.io',
      transports:        ['websocket', 'polling'],
      autoConnect:       false,   // we connect explicitly in useSessionSocket
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
  }
  return _socket;
}

/** Tear down socket completely (call on logout / session end). */
export function destroySocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
