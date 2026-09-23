import os from 'os';
import * as mediasoup from 'mediasoup';
import { workerSettings } from '../config/mediasoup';

const workers: mediasoup.types.Worker[] = [];
let nextWorkerIndex = 0;

const NUM_WORKERS = Math.max(1, Math.min(os.cpus().length, 4));

export async function initializeWorkers(): Promise<void> {
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = await mediasoup.createWorker(workerSettings);
    worker.on('died', () => {
      console.error(`mediasoup worker ${worker.pid} died, exiting in 2s`);
      setTimeout(() => process.exit(1), 2000);
    });
    workers.push(worker);
  }
  console.log(`mediasoup: started ${workers.length} worker(s)`);
}

export function getNextWorker(): mediasoup.types.Worker {
  if (workers.length === 0) {
    throw new Error('mediasoup workers not initialized');
  }
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}
