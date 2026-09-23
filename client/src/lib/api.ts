import { AuthUser, CreatedMeeting, MeetingDetail, MeetingSummary } from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'agm:authToken';

export function getStoredToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storeToken(token: string | undefined): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage may be unavailable (private browsing); the session just won't survive a reload.
  }
}

async function request<T>(path: string, init: RequestInit = {}, authed = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authed) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${SERVER_URL}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const loginRequest = (email: string, password: string) =>
  request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const registerRequest = (name: string, email: string, password: string) =>
  request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });

export const fetchMe = () => request<{ user: AuthUser }>('/api/auth/me', {}, true);

export interface MeetingBrandingInput {
  scheduledAt?: string;
  logoUrl?: string;
  waitingVideoUrl?: string;
  tagline?: string;
}

export function createMeeting(
  companyName: string,
  title: string,
  hostName: string,
  branding: MeetingBrandingInput = {},
): Promise<CreatedMeeting> {
  return request<CreatedMeeting>(
    '/api/meetings',
    { method: 'POST', body: JSON.stringify({ companyName, title, hostName, ...branding }) },
    true,
  );
}

export const listMeetings = () => request<MeetingSummary[]>('/api/meetings', {}, true);

/** Public: the join page and admin dashboard both read a single meeting without needing an account. */
export const getMeeting = (id: string) => request<MeetingDetail>(`/api/meetings/${id}`);

export { SERVER_URL };
