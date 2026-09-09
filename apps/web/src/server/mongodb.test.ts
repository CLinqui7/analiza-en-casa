import { describe, expect, it } from 'vitest';
import { MongoConfigurationError, mongoRuntimeConfig } from './mongodb';

describe('Mongo runtime configuration', () => {
  it('fails closed outside mongodb mode', () => {
    expect(() => mongoRuntimeConfig({ ANALIZA_DATA_MODE: 'demo' })).toThrow(
      MongoConfigurationError,
    );
  });

  // test-id: vitest:db01-mongo-no-uri-leak
  it('does not include a configured URI in a missing-config error', () => {
    const uri = 'mongodb+srv://synthetic-user:synthetic-password@example.invalid/db';
    expect(() => mongoRuntimeConfig({ ANALIZA_DATA_MODE: 'mongodb', MONGODB_URI: uri })).toThrow(
      'configuración segura',
    );
    try {
      mongoRuntimeConfig({ ANALIZA_DATA_MODE: 'mongodb', MONGODB_URI: uri });
    } catch (error) {
      expect(String(error)).not.toContain(uri);
    }
  });

  it('requires the server-only mode, URI and database name', () => {
    expect(
      mongoRuntimeConfig({
        ANALIZA_DATA_MODE: 'mongodb',
        MONGODB_URI: 'mongodb://synthetic.invalid',
        MONGODB_DB: 'analiza_synthetic',
      }),
    ).toEqual({ uri: 'mongodb://synthetic.invalid', database: 'analiza_synthetic' });
  });
});
