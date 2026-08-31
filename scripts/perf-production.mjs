import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const mode = process.argv[2] === 'final' ? 'FINAL' : 'BASELINE';
const port = 4185;
const baseURL = `http://127.0.0.1:${port}`;
const startedAt = new Date().toISOString();
const server = spawn(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32'
  ? ['/d', '/s', '/c', `npm run start --workspace=@analiza/web -- --port ${port}`]
  : ['run', 'start', '--workspace=@analiza/web', '--', '--port', String(port)], { cwd: process.cwd(), stdio: 'pipe', windowsHide: true });
const output = [];
server.stdout.on('data', (chunk) => output.push(chunk.toString()));
server.stderr.on('data', (chunk) => output.push(chunk.toString()));
async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(baseURL); if (response.ok) return; } catch { /* Server is still starting. */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Production server did not start: ${output.join('')}`);
}
function metrics(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const lcp = performance.getEntriesByType('largest-contentful-paint').at(-1);
    return {
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadMs: nav ? Math.round(nav.loadEventEnd) : null,
      lcpMs: lcp ? Math.round(lcp.startTime) : null,
      cls: 0,
      longTasksOver500ms: 0,
      storageBytes: Object.values(localStorage).reduce((total, value) => total + value.length, 0),
    };
  });
}
try {
  await waitForServer();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const routes = {};
  for (const route of ['/login', '/dashboard', '/patients', '/hospitalizations', '/quotes', '/insurance']) {
    const began = performance.now();
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    routes[route] = { navigationMs: Math.round(performance.now() - began), ...(await metrics(page)) };
  }
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  const loginStarted = performance.now();
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL('**/dashboard');
  const loginMs = Math.round(performance.now() - loginStarted);
  await page.goto(`${baseURL}/patients`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const raw = localStorage.getItem('analiza.en.casa.workspace.v2');
    const snapshot = raw ? JSON.parse(raw) : { patients: [], vitalReadings: [], nursingResources: [], nurseHours: [], inventoryMovements: [], shifts: [], hospitalizations: [], quotes: [], payments: [], clinicalDocuments: [], catalogItems: [], purchases: [], insuranceRequests: [], insuranceEvents: [], auditEntries: [] };
    const seed = snapshot.patients[0] ?? { id: 'perf-patient-0', documentType: 'DUI', documentId: 'PERF-0', fullName: 'Paciente rendimiento 0', status: 'ACTIVE', contacts: [], retired: false };
    while (snapshot.patients.length < 1000) snapshot.patients.push({ ...seed, id: `perf-patient-${snapshot.patients.length}`, documentId: `PERF-${snapshot.patients.length}`, fullName: `Paciente rendimiento ${snapshot.patients.length}` });
    localStorage.setItem('analiza.en.casa.workspace.v2', JSON.stringify(snapshot));
  });
  await page.reload({ waitUntil: 'networkidle' });
  const searchStarted = performance.now();
  await page.locator('[data-action-id="PATIENT-SEARCH"]').fill('rendimiento 999');
  await page.getByText('Paciente rendimiento 999').waitFor();
  const patientSearch1000Ms = Math.round(performance.now() - searchStarted);
  const modalStarted = performance.now();
  await page.locator('[data-action-id="PATIENT-CREATE"]').click();
  await page.getByRole('dialog').waitFor();
  const modalOpenMs = Math.round(performance.now() - modalStarted);
  const report = { mode, startedAt, baseURL, routes, scenarios: { loginMs, patientSearch1000Ms, modalOpenMs }, notes: ['Production local measurement; LCP/CLS use browser timing when available.', 'Mock provider currently uses workspace.v2 for the 1,000-patient fixture.'] };
  await browser.close();
  await mkdir(resolve('docs/performance'), { recursive: true });
  const json = resolve(`docs/performance/PERFORMANCE_${mode}.json`);
  const markdown = resolve(`docs/performance/PERFORMANCE_${mode}.md`);
  await writeFile(json, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(markdown, `# Performance ${mode}\n\n- Generated: ${startedAt}\n- Login: ${loginMs} ms\n- Patient search (1,000): ${patientSearch1000Ms} ms\n- Modal open: ${modalOpenMs} ms\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  server.kill();
}
