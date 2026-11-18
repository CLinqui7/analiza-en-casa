import { buildClinicalPdf } from '../apps/web/src/lib/clinical-pdf';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const file = '.local/extras18-browser/clinical-symbols.pdf';
writeFileSync(
  file,
  await buildClinicalPdf([
    { text: 'Prueba sintética de símbolos', heading: 1 },
    { text: 'SpO₂ · μg · Descripción clínica' },
  ]),
);
const text = execFileSync(
  'python',
  [
    '-c',
    'import sys; from pypdf import PdfReader; sys.stdout.buffer.write("\\n".join(p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages).encode("utf-8"))',
    file,
  ],
  { encoding: 'utf8' },
);
assert.ok(text.includes('SpO2 · µg · Descripción clínica'));
assert.ok(!text.includes('[U+'));
console.log('PASS: final PDF preserves common clinical symbols and accents');
