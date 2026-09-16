import { describe, expect, it } from 'vitest';
import { corePages, isReleasedCommand, isReleasedPath } from './release-profile';

describe('Core release boundary', () => {
  it('keeps operational pages, auth and resource endpoints', () => {
    for (const path of [
      ...corePages,
      '/patients/abc',
      '/hospitalizations/abc',
      '/login',
      '/api/auth/login',
      '/api/patients/abc',
      '/api/files/abc',
      '/api/feedback',
      '/feedback',
      '/api/health',
    ]) {
      expect(isReleasedPath(path, true), path).toBe(true);
    }
  });
  it('closes incomplete direct routes and endpoints with path boundaries', () => {
    for (const path of [
      '/quotes',
      '/api/quotes/1/send',
      '/clinical',
      '/inventory',
      '/payments',
      '/changes',
      '/portal',
      '/patients-extra',
      '/catalogs',
    ]) {
      expect(isReleasedPath(path, true), path).toBe(false);
      expect(isReleasedPath(path, false), path).toBe(true);
    }
  });
  it('does not allow hidden mutations through the shared command endpoint', () => {
    expect(isReleasedCommand('nurse.create', true)).toBe(true);
    expect(isReleasedCommand('configuration.save', true)).toBe(true);
    for (const command of ['payment.apply', 'clinical.create', 'purchase.create', undefined]) {
      expect(isReleasedCommand(command, true)).toBe(false);
    }
  });
});
