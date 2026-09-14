import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const browser = await chromium.connectOverCDP(process.argv[2]);
const page = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes('ANALIZA_STUDIO_FUNCIONAL.html'));
if (!page) throw new Error('Open the Studio reference in the browser first.');
const output = path.resolve('.local/studio-reference');
await mkdir(output, { recursive: true });
const routes = await page.locator('a[href^="#/"]').evaluateAll(nodes => [...new Map(nodes.map(node => [node.getAttribute('href'), { route: node.getAttribute('href'), label: node.textContent.trim() }])).values()]);
const report = [];
for (const item of routes) {
  await page.evaluate(route => { location.hash = route; }, item.route);
  await page.waitForTimeout(120);
  const file = item.route.replace('#/', '').replaceAll('/', '-') || 'dashboard';
  const details = await page.evaluate(() => ({
    headings: [...document.querySelectorAll('h1,h2,h3')].map(x => x.textContent.trim()),
    actions: [...document.querySelectorAll('.content button,.content a')].map(x => ({ text: x.textContent.trim(), action: x.dataset.action, href: x.getAttribute('href') })),
    columns: [...document.querySelectorAll('.content th')].map(x => x.textContent.trim()),
    text: document.querySelector('.content')?.innerText,
    tokens: Object.fromEntries(['--canvas','--ink','--sidebar-w','--brand','--primary'].map(key => [key, getComputedStyle(document.documentElement).getPropertyValue(key)])),
  }));
  await page.screenshot({ path: path.join(output, `${file}.png`) });
  report.push({ ...item, ...details, screenshot: `${file}.png` });
  console.log(JSON.stringify({ route: item.route, label: item.label, headings: details.headings, columns: details.columns }));
}
await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
await browser.close();
