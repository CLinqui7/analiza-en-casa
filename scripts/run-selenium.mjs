import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const pattern = process.argv[2] ?? 'test_*.py';
const testNamePattern = process.argv[3];
const requestedBaseUrl = process.env.SELENIUM_BASE_URL;
const baseUrl = requestedBaseUrl ?? 'http://127.0.0.1:4188';
const serverUrl = new URL(baseUrl);
const ownsServer = !requestedBaseUrl;
const serverOutput = [];
let server;

function remember(chunk) {
  serverOutput.push(String(chunk));
  if (serverOutput.length > 80) serverOutput.shift();
}

async function isReady() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await isReady()) return;
    if (server?.exitCode !== null)
      throw new Error(`El servidor Selenium terminó antes de iniciar (${server?.exitCode}).`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('El servidor Selenium no respondió en 120 segundos.');
}

function stopOwnedServer() {
  if (!server?.pid || !ownsServer) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
  }
}

const testEnvironment = {
  ...process.env,
  ANALIZA_DATA_MODE: 'demo',
  NEXT_PUBLIC_DATA_MODE: 'mock',
  SELENIUM_BASE_URL: baseUrl,
};

try {
  if (ownsServer) {
    if (await isReady())
      throw new Error(
        `El puerto ${serverUrl.port} ya está ocupado; no se reutilizará un servidor ajeno.`,
      );
    server = spawn(
      process.execPath,
      [
        path.join(process.cwd(), 'node_modules/next/dist/bin/next'),
        'dev',
        '--port',
        serverUrl.port,
      ],
      {
        cwd: path.join(process.cwd(), 'apps/web'),
        env: testEnvironment,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    server.stdout.on('data', remember);
    server.stderr.on('data', remember);
    await waitUntilReady();
  }

  const python = process.platform === 'win32' ? 'py' : 'python3';
  const unittestArguments = ['-m', 'unittest', 'discover', '-s', 'tests/selenium', '-p', pattern, '-v'];
  if (testNamePattern) unittestArguments.push('-k', testNamePattern);
  const tests = spawn(
    python,
    unittestArguments,
    { cwd: process.cwd(), env: testEnvironment, stdio: 'inherit' },
  );
  const exitCode = await new Promise((resolve, reject) => {
    tests.once('error', reject);
    tests.once('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} catch (error) {
  process.exitCode = 1;
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  if (serverOutput.length) process.stderr.write(serverOutput.join(''));
} finally {
  stopOwnedServer();
}
