import { expect, it } from 'vitest';
import { privateMultipart, withPrivateUpload, UploadBusyError } from './private-multipart';

it('parses real multipart bytes without changing the upload', async () => {
  const form = new FormData();
  form.set('file', new File(['synthetic'], 'qa.txt'));
  const parsed = await privateMultipart(
    new Request('http://localhost', { method: 'POST', body: form }),
  );
  expect(await (parsed.get('file') as File).text()).toBe('synthetic');
});
it('rejects an oversized declared body before reading it', async () => {
  await expect(
    privateMultipart(
      new Request('http://localhost', {
        method: 'POST',
        body: 'x',
        headers: { 'content-length': String(30 * 1024 * 1024) },
      }),
    ),
  ).rejects.toThrow('tamaño');
});
it('rejects a chunked body that exceeds the limit without Content-Length', async () => {
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(26 * 1024 * 1024));
      c.close();
    },
  });
  const request = new Request('http://localhost', {
    method: 'POST',
    body,
    duplex: 'half',
    headers: { 'content-type': 'multipart/form-data; boundary=qa' },
  } as RequestInit);
  await expect(privateMultipart(request)).rejects.toThrow('válido');
});
it('limits concurrent transfers and releases slots even on failure', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((r) => {
    finish = r;
  });
  const a = withPrivateUpload(() => pending);
  const b = withPrivateUpload(() => pending);
  await expect(withPrivateUpload(async () => 'excess')).rejects.toBeInstanceOf(UploadBusyError);
  finish();
  await Promise.all([a, b]);
  await expect(
    withPrivateUpload(async () => {
      throw Error('synthetic outage');
    }),
  ).rejects.toThrow('outage');
  await expect(withPrivateUpload(async () => 'available')).resolves.toBe('available');
});
