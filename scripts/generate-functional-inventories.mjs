import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoots = ['app', 'api', 'scripts', 'apps/web/src', 'packages', 'supabase'];
const codeExtensions = new Set(['.js', '.mjs', '.ts', '.tsx', '.sql']);

async function collectFiles(directory) {
  const absolute = join(root, directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return codeExtensions.has(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

function category(file) {
  if (file.startsWith('packages/domain')) return 'Lógica de dominio pura';
  if (file.startsWith('packages/contracts')) return 'Contratos y validación';
  if (file.startsWith('packages/ui')) return 'Componentes reutilizables';
  if (file.startsWith('apps/web')) return 'Aplicación React / Next.js';
  if (file.startsWith('api')) return 'Endpoints de servidor';
  if (file.startsWith('supabase')) return 'Migraciones y seguridad de datos';
  if (file.startsWith('app')) return 'Demo heredado / interfaz y flujos';
  return 'Automatización y QA';
}

function lineAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function findFunctions(source) {
  const found = [];
  const pattern = /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g;
  for (const match of source.matchAll(pattern)) found.push({ name: match[1] ?? match[2], line: lineAt(source, match.index ?? 0) });
  return found;
}

function isUiCandidate(value) {
  const clean = value.replace(/\\[nrt'"`]/g, ' ').trim();
  return clean.length >= 4 && clean.length <= 180 && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(clean) && /\s|[¿¡:,.]/.test(clean) && !/[{};]|=>|<\/?[a-z]/i.test(clean) && !/^(?:https?:|\/|\.|@|[\w/-]+\.(?:js|ts|tsx|css|json))/.test(clean);
}

function redacted(value, source, index) {
  const context = source.slice(Math.max(0, index - 100), index + value.length + 100);
  if (/(?:password|secret|token|service.?role|api.?key|demo2026)/i.test(context)) return '[REDACTADO: literal sensible]';
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

const files = (await Promise.all(sourceRoots.map(collectFiles))).flat().sort();
const functions = [];
const strings = new Map();
for (const file of files) {
  const source = await readFile(join(root, file), 'utf8');
  for (const item of findFunctions(source)) functions.push({ file, ...item });
  const stringPattern = /(['"`])((?:\\.|(?!\1|\r|\n).){0,180}?)\1/g;
  for (const match of source.matchAll(stringPattern)) {
    const value = match[2];
    const index = match.index ?? 0;
    if (!isUiCandidate(value)) continue;
    const redactedValue = redacted(value, source, index);
    const current = strings.get(redactedValue);
    if (current) current.count += 1;
    else strings.set(redactedValue, { file, line: lineAt(source, index), value: redactedValue, count: 1 });
  }
}

const byCategory = Map.groupBy(functions, (item) => category(item.file));
const functionalLines = [
  '# Inventario funcional',
  '',
  'Generado de forma determinista desde el código fuente. No sustituye la revisión de evidencia de video; sirve para clasificar y proteger la migración.',
  '',
  `Archivos inspeccionados: ${files.length}. Funciones o manejadores nombrados: ${functions.length}.`,
  '',
];
for (const [name, entries] of [...byCategory.entries()].sort(([left], [right]) => left.localeCompare(right, 'es'))) {
  functionalLines.push(`## ${name}`, '', '| Archivo | Línea | Función / manejador |', '| --- | ---: | --- |');
  for (const entry of entries) functionalLines.push(`| \`${entry.file}\` | ${entry.line} | \`${entry.name}\` |`);
  functionalLines.push('');
}
functionalLines.push('## Criterio de migración', '', '- Lógica pura: mover o mantener en `packages/domain` con pruebas unitarias.', '- Contratos y validaciones: centralizar en `packages/contracts`.', '- Componentes compartidos: centralizar en `packages/ui`.', '- Flujos de UI: implementar de forma explícita en `apps/web`; el demo heredado no se carga dentro de React.', '- Endpoints, migraciones y políticas: conservar autorización del lado servidor, RLS y auditoría.');

const auditLines = [
  '# Auditoría de textos visibles',
  '',
  'Generado de forma determinista desde el código fuente. Incluye candidatos literales para internacionalización o centralización; valores sensibles se redactan automáticamente.',
  '',
  `Candidatos únicos encontrados: ${strings.size}.`,
  '',
  '| Archivo | Línea | Repeticiones | Literal candidato | Acción propuesta |',
  '| --- | ---: | ---: | --- | --- |',
];
for (const item of [...strings.values()].sort((left, right) => left.file.localeCompare(right.file, 'es') || left.line - right.line)) auditLines.push(`| \`${item.file}\` | ${item.line} | ${item.count} | ${item.value} | Extraer a catálogo de mensajes al tocar este flujo |`);
auditLines.push('', '## Priorización', '', '1. Mensajes de error, validación, seguridad y acciones irreversibles.', '2. Navegación, formularios y vacíos de datos.', '3. Etiquetas de reporte, ayuda y elementos decorativos.', '', 'La migración React usa textos cercanos al flujo hasta que se apruebe un catálogo de idioma y tono. Ningún texto de notificación contiene detalles clínicos sensibles.');

const outputs = [
  ['docs/FUNCTIONAL_INVENTORY.md', functionalLines.join('\n')],
  ['docs/UI_STRING_AUDIT.md', auditLines.join('\n')],
];
for (const [file, content] of outputs) {
  const output = join(root, file);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${content}\n`, 'utf8');
}
console.log(JSON.stringify({ files: files.length, functions: functions.length, uniqueUiStringCandidates: strings.size, outputs: outputs.map(([file]) => file) }));
