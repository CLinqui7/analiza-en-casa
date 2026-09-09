import { describe, expect, it, vi } from 'vitest';
import { privateFileDownloadHref, uploadPrivateFiles } from './private-files';

describe('private file browser boundary', () => {
  // test-id: vitest:e02-private-file-multipart-browser-boundary
  it('sends selected bytes as authenticated multipart rather than filename metadata JSON', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            id: 'file-synthetic-1',
            ownerType: 'doctor',
            ownerId: 'doctor-synthetic-1',
            name: 'documento-sintetico.pdf',
            mimeType: 'application/pdf',
            size: 3,
            sha256: 'a'.repeat(64),
          }),
        ),
    );
    const file = new File(['abc'], 'documento-sintetico.pdf', { type: 'application/pdf' });

    await expect(
      uploadPrivateFiles('doctor', 'doctor-synthetic-1', [file], fetchMock, () => ({
        'X-Analiza-Csrf': 'synthetic-test-token',
      })),
    ).resolves.toHaveLength(1);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/files',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(request.headers).toEqual({ 'X-Analiza-Csrf': 'synthetic-test-token' });
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get('file')).toBe(file);
    expect((request.body as FormData).get('ownerId')).toBe('doctor-synthetic-1');
  });

  // test-id: vitest:e02-private-file-download-path-encoded
  it('uses the bounded authenticated file path for download', () => {
    expect(privateFileDownloadHref('file / synthetic')).toBe('/api/files/file%20%2F%20synthetic');
  });
});
