import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { env } from './config/env';
import { initDb } from './db/db';
import { inviteManager } from './invite/InviteManager';
import { meetingManager } from './meeting/MeetingManager';
import { initializeWorkers } from './mediasoup/workerPool';
import { meetingsRouter } from './routes/meetings';
import { registerSignaling } from './socket/signaling';

async function main() {
  await initDb();
  await initializeWorkers();
  const restored = await meetingManager.restoreFromDb();
  await inviteManager.restoreFromDb();
  if (restored) console.log(`Restored ${restored} meeting(s) from Postgres`);

  const app = express();
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/meetings', meetingsRouter);

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin },
  });

  registerSignaling(io);

  httpServer.listen(env.port, () => {
    console.log(`Virtual AGM server listening on port ${env.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
