import { describe, expect, it } from 'vitest';
import { GET, POST } from './route';

describe('Mongo workspace route', () => {
  // test-id: vitest:db01-workspace-route-fail-closed
  it('does not expose workspace data before server identity is provisioned', async () => {
    await expect(GET()).resolves.toMatchObject({ status: 503 });
    await expect(POST()).resolves.toMatchObject({ status: 503 });
  });
});
