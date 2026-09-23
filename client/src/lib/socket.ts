import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from './api';

export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

export function connectSocket(): Socket {
  return io(SERVER_URL, { transports: ['websocket'] });
}

export function emitWithAck<Req extends Record<string, unknown> | undefined, Res>(
  socket: Socket,
  event: string,
  payload?: Req,
): Promise<Res> {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (response: Ack<Res>) => {
      if (response.ok) resolve(response.data);
      else reject(new Error(response.error));
    });
  });
}
