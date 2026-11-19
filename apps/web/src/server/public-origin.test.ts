import { describe, expect, it } from 'vitest';
import { publicOrigin } from './public-origin';

describe('public link origin', () => {
  it('uses an explicit external HTTPS origin instead of the internal request host', () => {
    expect(publicOrigin({ ANALIZA_PUBLIC_ORIGIN: 'https://analiza.example/' })).toBe(
      'https://analiza.example',
    );
  });
  it('rejects missing, internal, injected and unencrypted production origins', () => {
    for (const value of [
      undefined,
      'https://0.0.0.0:8080',
      'https://analiza.example@evil.example',
      'https://analiza.example/path',
      'https://analiza.example?redirect=evil.example',
      'http://analiza.example',
    ]) {
      expect(() =>
        publicOrigin({ ANALIZA_PUBLIC_ORIGIN: value, NODE_ENV: 'production' }),
      ).toThrow();
    }
  });
});
