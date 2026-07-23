import { io, Socket } from 'socket.io-client';
import { store } from '../app/store';

let socket: Socket | null = null;

/** Lazily creates (or reuses) a single authenticated Socket.IO connection.
 *  Reconnects automatically; re-authenticates with the current access token
 *  on every connect since tokens can rotate via the refresh flow. */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    const token = store.getState().auth.accessToken;
    if (token) socket?.emit('authenticate', token);
  });
  return socket;
}
