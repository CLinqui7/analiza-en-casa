import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('task-oriented links share a visible button treatment without underlines', async () => {
  const css = await source('apps/web/src/app/theme.css');

  assert.match(css, /\.action-link-button,\s*\.text-link\s*\{/);
  assert.match(css, /min-height:\s*36px/);
  assert.match(css, /border:\s*1px solid #bfd2d7/);
  assert.match(css, /border-radius:\s*10px/);
  assert.match(css, /text-decoration:\s*none !important/);
  assert.match(css, /\.action-link-button--compact\s*\{[^}]*min-height:\s*32px/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('primary workspace actions render as buttons instead of bare text links', async () => {
  const [quotes, dashboard, patients, hospitalizations, insurance] = await Promise.all([
    source('apps/web/src/app/(workspace)/quotes/page.tsx'),
    source('apps/web/src/app/(workspace)/dashboard/page.tsx'),
    source('apps/web/src/app/(workspace)/patients/page.tsx'),
    source('apps/web/src/app/(workspace)/hospitalizations/page.tsx'),
    source('apps/web/src/app/(workspace)/insurance/page.tsx'),
  ]);

  assert.match(
    quotes,
    /className="action-link-button action-link-button--compact"[\s\S]*?data-action-id="QUOTE-DETAIL-NAVIGATE"[\s\S]*?Consultar/,
  );
  assert.match(dashboard, /className="action-link-button action-link-button--compact"/);
  assert.match(
    patients,
    /className="action-link-button action-link-button--compact"[\s\S]*?data-action-id="PATIENT-DETAIL-NAVIGATE"[\s\S]*?Consultar/,
  );
  assert.match(hospitalizations, /Consult(ar|ar pacientes|ar hospitalización)|Gestionar/);
  assert.match(
    insurance,
    /className="action-link-button action-link-button--compact"[\s\S]*?Consultar/,
  );
});

test('patient edit is one valid interactive control and does not nest a button in a link', async () => {
  const detail = await source('apps/web/src/app/(workspace)/patients/[id]/page.tsx');

  assert.match(detail, /<Link[\s\S]*?className="button"[\s\S]*?Editar paciente[\s\S]*?<\/Link>/);
  assert.doesNotMatch(detail, /<Link[^>]*>[\s\S]*?<Button[^>]*>Editar paciente<\/Button>/);
});
