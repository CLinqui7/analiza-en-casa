import { channel } from 'node:diagnostics_channel';
import type { Socket } from 'node:net';
import type { Server } from 'node:http';

export async function registerNodeRuntime() {
  if (process.env.ANALIZA_CONTAINER_RUNTIME === '1') {
    if (
      process.env.ANALIZA_API_ORIGIN ||
      process.env.ANALIZA_DATA_MODE !== process.env.NEXT_PUBLIC_DATA_MODE
    ) {
      throw new Error('Container runtime must match its compiled data mode and use its own API.');
    }
    // Chrome/proxies can preconnect without sending HTTP bytes. Node's server.close()
    // leaves these sockets open; Next then exceeds Cloud Run's 10s shutdown grace.
    // Observe only inbound sockets with Node's channel. Keep Next's own server/launcher
    // and graceful drain; never destroy a connection that has carried a request.
    const incoming = channel('net.server.socket');
    const finished = channel('http.server.response.finish');
    let closing = false;
    const sockets = new Set<Socket>();
    const track = (message: unknown) => {
      const { socket } = message as { socket: Socket };
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
    };
    incoming.subscribe(track);
    finished.subscribe((message: unknown) => {
      if (closing) {
        const { server } = message as { server: Server };
        // Node can turn an active request into a keep-alive socket after server.close().
        // Wait for its response bookkeeping, then close only idle connections.
        queueMicrotask(() => server.closeIdleConnections());
      }
    });
    const closeUnused = () => {
      closing = true;
      incoming.unsubscribe(track);
      for (const socket of sockets) {
        if (socket.bytesRead === 0 && socket.bytesWritten === 0) socket.destroy();
      }
    };
    process.once('SIGTERM', closeUnused);
    process.once('SIGINT', closeUnused);
  }
  if (process.env.ANALIZA_DATA_MODE === 'postgresql') {
    const { closePostgresPool } = await import('./persistence/postgres-pool');
    const close = () => {
      void closePostgresPool().catch(() => undefined);
    };
    process.once('SIGTERM', close);
    process.once('SIGINT', close);
  }
}
