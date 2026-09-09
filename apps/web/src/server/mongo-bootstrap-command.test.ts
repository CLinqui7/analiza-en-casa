import { describe, expect, it } from 'vitest';
import { runMongoBootstrap } from './mongo-bootstrap-command';

describe('Mongo bootstrap operator command', () => {
  // test-id: vitest:m02-bootstrap-command-rejects-unknown-arguments
  it('rejects unknown arguments before reading configuration or opening a database connection', async () => {
    await expect(runMongoBootstrap(['--unsafe'])).rejects.toThrow('Uso: mongo:bootstrap');
  });
});
