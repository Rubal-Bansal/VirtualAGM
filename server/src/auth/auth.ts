import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { pool } from '../db/db';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

const TOKEN_TTL = '7d';

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

/** Express 4 doesn't catch rejected promises from async handlers; answer with a 500 instead of crashing. */
export function wrap(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch((err) => {
      console.error('Request failed', err);
      if (!res.headersSent) res.status(500).json({ error: 'Something went wrong' });
      else next(err);
    });
  };
}

function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: TOKEN_TTL });
}

function toUser(row: { id: string; name: string; email: string }): AuthUser {
  return { id: row.id, name: row.name, email: row.email };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [payload.sub]);
    if (!rows[0]) {
      res.status(401).json({ error: 'Account no longer exists' });
      return;
    }
    req.user = toUser(rows[0]);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

export const authRouter = Router();

authRouter.post('/register', wrap(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!name || !email.includes('@')) {
    res.status(400).json({ error: 'Name and a valid email are required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  const id = randomUUID();
  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query('INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)', [
      id,
      name,
      email,
      hash,
    ]);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    throw err;
  }
  const user = { id, name, email };
  res.status(201).json({ token: signToken(user), user });
}));

authRouter.post('/login', wrap(async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const row = rows[0];
  // Same message for unknown email and wrong password so accounts can't be enumerated.
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    res.status(401).json({ error: 'Incorrect email or password' });
    return;
  }
  const user = toUser(row);
  res.json({ token: signToken(user), user });
}));

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
