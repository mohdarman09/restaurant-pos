import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { env } from '../config/env';

let io: SocketIOServer | null = null;

/** Initializes Socket.IO on top of the existing HTTP server. Clients join an
 *  `outlet:<id>` room after authenticating with the same JWT access token used
 *  for REST calls, so KDS/table updates only reach the outlet they belong to. */
export function initRealtime(httpServer: HttpServer): void {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.on('connection', (socket: Socket) => {
    socket.on('authenticate', (token: string) => {
      try {
        const payload = verifyAccessToken(token);
        if (payload.outletId) {
          socket.join(`outlet:${payload.outletId}`);
          socket.emit('authenticated', { ok: true });
        }
      } catch {
        socket.emit('authenticated', { ok: false });
      }
    });
  });
}

/** Broadcasts a kitchen-ticket change to everyone viewing that outlet's KDS. */
export function emitKdsUpdate(outletId: string): void {
  io?.to(`outlet:${outletId}`).emit('kds:update');
}

/** Broadcasts a table-status change to everyone viewing that outlet's floor plan. */
export function emitTablesUpdate(outletId: string): void {
  io?.to(`outlet:${outletId}`).emit('tables:update');
}
