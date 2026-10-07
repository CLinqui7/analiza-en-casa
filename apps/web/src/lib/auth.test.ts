import { describe, expect, it } from 'vitest';
import { canOpenDashboard, landingPath, type AuthSession } from './auth';

const session = (role: AuthSession['role'], dashboardAccess = false): AuthSession => ({
  userId: 'test-user',
  role,
  dashboardAccess,
  mode: 'postgresql',
});

describe('account-specific dashboard access', () => {
  it('denies the dashboard to nurses without an explicit grant', () => {
    expect(canOpenDashboard(session('NURSE'))).toBe(false);
    expect(landingPath(session('NURSE'))).toBe('/patients');
    expect(landingPath(session('NURSE'), '/dashboard')).toBe('/patients');
  });

  it('allows a nurse with a grant and keeps administrator access', () => {
    expect(canOpenDashboard(session('NURSE', true))).toBe(true);
    expect(landingPath(session('NURSE', true))).toBe('/dashboard');
    expect(canOpenDashboard(session('ADMIN'))).toBe(true);
    expect(canOpenDashboard(session('WEBMASTER'))).toBe(true);
  });

  it('preserves the analytics-only landing page', () => {
    expect(landingPath(session('ANALYTICS'))).toBe('/analytics/logins');
  });
});
