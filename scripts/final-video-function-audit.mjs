import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const input = path.join(root, 'docs', 'qa', 'VIDEO_TO_REACT_TRACEABILITY.json');
const output = path.join(root, 'docs', 'release', 'FINAL_VIDEO_FUNCTION_AUDIT.md');

const parsed = JSON.parse(fs.readFileSync(input, 'utf8'));
const requirements = Array.isArray(parsed.requirements) ? parsed.requirements : [];

if (requirements.length !== 210) {
  throw new Error(`Expected 210 canonical video requirements, found ${requirements.length}.`);
}

const countBy = (key) =>
  requirements.reduce((acc, item) => {
    const value = item[key] ?? 'UNSET';
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

const parity = countBy('parity_status');
const functional = countBy('functional_status');
const chapters = [...new Set(requirements.map((item) => item.chapter_id))].sort();

const missingEvidence = requirements.filter(
  (item) => !Array.isArray(item.evidence_paths) || item.evidence_paths.length === 0,
);
const missingClassification = requirements.filter((item) => !item.classification);
const actionable = requirements.filter(
  (item) =>
    ['MISSING', 'PARTIAL'].includes(item.parity_status) &&
    !item.blocker_type &&
    !item.blocker_reason &&
    !(Array.isArray(item.blocker_ids) && item.blocker_ids.length > 0),
);
const blocked = requirements.filter((item) => Boolean(item.blocker_type || item.blocker_reason));
const notExact = requirements.filter((item) => item.parity_status !== 'EXACT');

const esc = (value) =>
  String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ')
    .trim();

const lines = [];
lines.push('# Auditoría final · Video â†’ React · Analiza en Casa');
lines.push('');
lines.push(`Generado: ${new Date().toISOString()}`);
lines.push(`Fuente: \`docs/qa/VIDEO_TO_REACT_TRACEABILITY.json\``);
lines.push(`Requisitos canónicos revisados: **${requirements.length}/210**`);
lines.push('');
lines.push('## Regla de lectura');
lines.push('');
lines.push(
  '**210/210 trazados no significa 210/210 implementados.** Esta auditoría conserva exactamente la clasificación canónica y no convierte reglas clínicas, financieras o integraciones no aprobadas en funcionalidades inventadas.',
);
lines.push('');
lines.push('## Resumen');
lines.push('');
lines.push('| Estado de paridad | Cantidad |');
lines.push('|---|---:|');
for (const [key, value] of Object.entries(parity).sort()) lines.push(`| ${key} | ${value} |`);
lines.push('');
lines.push('| Estado funcional | Cantidad |');
lines.push('|---|---:|');
for (const [key, value] of Object.entries(functional).sort()) lines.push(`| ${key} | ${value} |`);
lines.push('');
lines.push(`- Capítulos presentes: **${chapters.length}/17**.`);
lines.push(`- Requisitos con bloqueo explícito: **${blocked.length}**.`);
lines.push(`- Requisitos no EXACT: **${notExact.length}**.`);
lines.push(`- Gaps MISSING/PARTIAL sin blocker explícito: **${actionable.length}**.`);
lines.push(`- Requisitos sin evidence_paths: **${missingEvidence.length}**.`);
lines.push(`- Requisitos sin classification: **${missingClassification.length}**.`);
lines.push('');
lines.push('## Gaps accionables sin bloqueo explícito');
lines.push('');
if (!actionable.length) {
  lines.push('No se encontraron gaps MISSING/PARTIAL sin un bloqueo explícito.');
} else {
  lines.push('| ID | Cap. | Prioridad | Paridad | Funcional | Función | Ruta |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const item of actionable) {
    lines.push(
      `| ${esc(item.requirement_id)} | ${esc(item.chapter_id)} | ${esc(item.priority)} | ${esc(item.parity_status)} | ${esc(item.functional_status)} | ${esc(item.feature)} | ${esc(item.react_route)} |`,
    );
  }
}
lines.push('');
lines.push('## Requisitos bloqueados o dependientes de definición/integración');
lines.push('');
lines.push('| ID | Cap. | Paridad | Tipo bloqueo | Función | Preguntas/Bloqueadores |');
lines.push('|---|---|---|---|---|---|');
for (const item of blocked) {
  lines.push(
    `| ${esc(item.requirement_id)} | ${esc(item.chapter_id)} | ${esc(item.parity_status)} | ${esc(item.blocker_type)} | ${esc(item.feature)} | ${esc([...(item.open_question_ids ?? []), ...(item.blocker_ids ?? [])].join(', '))} |`,
  );
}
lines.push('');
lines.push('## Matriz completa 210/210');
lines.push('');
lines.push(
  '| ID | Cap. | P | Clasificación | Paridad | Funcional | Persistencia | Permisos | Ruta React | Playwright | Selenium | Bloqueo | Función |',
);
lines.push('|---|---|---|---|---|---|---|---|---|---:|---:|---|---|');
for (const item of requirements) {
  lines.push(
    `| ${esc(item.requirement_id)} | ${esc(item.chapter_id)} | ${esc(item.priority)} | ${esc(item.classification)} | ${esc(item.parity_status)} | ${esc(item.functional_status)} | ${esc(item.persistence_status)} | ${esc(item.permissions_status)} | ${esc(item.react_route)} | ${(item.playwright_test_ids ?? []).length} | ${(item.selenium_test_ids ?? []).length} | ${esc(item.blocker_type)} | ${esc(item.feature)} |`,
  );
}
lines.push('');
lines.push('## Veredicto automático');
lines.push('');
if (missingEvidence.length || missingClassification.length) {
  lines.push('**FAIL DE TRAZABILIDAD:** existen requisitos sin evidencia o clasificación.');
} else if (actionable.length) {
  lines.push(
    '**REQUIERE REVISIÓN FUNCIONAL:** existen gaps MISSING/PARTIAL sin blocker explícito. Deben revisarse uno por uno antes de afirmar paridad funcional completa.',
  );
} else {
  lines.push(
    '**TRAZABILIDAD COMPLETA:** todos los gaps no EXACT están acompañados por una restricción/bloqueo explícito. Esto no autoriza inventar reglas ni habilitar funciones sensibles sin aprobación.',
  );
}
lines.push('');

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');

console.log(`Audit written: ${output}`);
console.log(`requirements=${requirements.length}`);
console.log(`parity=${JSON.stringify(parity)}`);
console.log(`actionable_gaps=${actionable.length}`);
console.log(`blocked=${blocked.length}`);
console.log(`missing_evidence=${missingEvidence.length}`);
console.log(`missing_classification=${missingClassification.length}`);

if (missingEvidence.length || missingClassification.length) process.exit(2);
