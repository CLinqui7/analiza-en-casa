import { afterEach, expect, it, vi } from 'vitest';
const database = vi.hoisted(() => ({ connect: vi.fn(), command: vi.fn() }));
vi.mock('@/server/mongodb', () => ({ mongoDatabase: database.connect }));
import { GET } from './route';
afterEach(() => vi.clearAllMocks());
it('reports readiness only after the Mongo ping succeeds', async () => {
  database.connect.mockResolvedValue({ command: database.command });
  database.command.mockResolvedValue({ ok: 1 });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(database.command).toHaveBeenCalledWith({ ping: 1 }, { timeoutMS: 2000 });
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ status: 'ready' });
});
it('never returns success or secrets when the database is unavailable', async () => {
  database.connect.mockRejectedValue(new Error('mongodb://synthetic-secret@example.invalid'));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: 'unavailable' });
});
