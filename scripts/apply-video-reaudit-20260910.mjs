import { readFile, writeFile } from 'node:fs/promises';

const path = 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.json';
const artifactSha = '4572c898518c9fef049451e926e57b21ed57e63b';
const document = JSON.parse(await readFile(path, 'utf8'));

const partial = new Map([
  [
    'CH01-F003',
    'Los datos existen en Detalle, pero la tabla Studio no conserva todas las columnas observadas.',
  ],
  [
    'CH01-F007',
    'Triage, consentimiento y estado persisten, pero triage/notificación ya no están en la tabla observada.',
  ],
  [
    'CH01-F009',
    'Se verifican seis rótulos; fórmulas y significado permanecen sin definición aprobada.',
  ],
  [
    'CH01-F013',
    'El acceso funciona; recuperación de clave sólo muestra un bloqueo honesto y no envía correo.',
  ],
  ['CH01-F014', 'Manifest y service worker existen, pero la instalación nativa no fue ejercida.'],
  [
    'CH02-F003',
    'Las cuatro secciones se conservan en un diálogo Studio; el video muestra una página completa.',
  ],
  ['CH02-F006', 'Los selectores funcionan únicamente con catálogos sintéticos.'],
  ['CH02-F009', 'La búsqueda funciona únicamente con aseguradoras sintéticas.'],
  ['CH02-F012', 'Una cobertura se guarda; multiplicidad y semántica siguen abiertas.'],
  ['CH02-F014', 'Sólo se extraen coordenadas explícitas; no se consulta una URL externa.'],
  [
    'CH02-F015',
    'Mapa responsive verificado; controles completos no fueron reejercidos en el candidato.',
  ],
  [
    'CH03-F002',
    'Panel y pestañas funcionan, pero el conteo observado no tiene fuente ni fórmula configurada.',
  ],
  [
    'CH03-F008',
    'React separa correctamente loading y vacío, a diferencia de la superposición observada.',
  ],
  [
    'CH03-F010',
    'Columnas y estados seguros existen; no hay envío real de preautorización/reclamo.',
  ],
]);

const blocked = new Map([
  ['CH01-F010', 'Faltan umbrales clínicos aprobados para clasificar las mediciones.'],
  ['CH02-F007', 'Falta confirmar consentimiento por defecto y proveedor real Botmaker/WhatsApp.'],
  [
    'CH02-F010',
    'La mezcla anómala de personas y aseguradoras observada requiere definición del cliente.',
  ],
  ['CH03-F006', 'Falta una regla aprobada para la transición Activo/Cerrado.'],
  ['CH05-F013', 'El precio automático requiere catálogo, tarifa y reglas aprobadas.'],
  [
    'CH11-F04',
    'Puntual/Turno requiere definición de entidad, duración, autorización y persistencia.',
  ],
  ['CH11-F05', 'Los tipos de visita requieren catálogo y reglas aprobadas.'],
]);

const notTestable = new Map([
  [
    'CH02-F016',
    'El video no muestra el resultado posterior de Guardar; React sí tiene una prueba local separada.',
  ],
  ['CH03-F003', 'El frame de Preadmisión es transitorio y no demuestra comportamiento.'],
]);

const missingIds = [
  'CH05-F011',
  'CH08-F06',
  'CH08-F08',
  'CH08-F09',
  'CH09-F03',
  'CH09-F04',
  'CH09-F05',
  'CH09-F06',
  'CH09-F07',
  'CH09-F10',
  'CH09-F11',
  'CH10-F03',
  'CH10-F04',
  'CH10-F05',
  'CH10-F07',
  'CH10-F08',
  'CH12-F02',
  'CH12-F03',
  'CH12-F04',
  'CH12-F05',
  'CH12-F06',
  'CH13-F08',
  'CH15-F01',
  'CH15-F02',
  'CH15-F03',
  'CH15-F04',
  'CH15-F07',
  'CH15-F11',
  'CH15-F12',
];

const missing = new Set(missingIds);
const changed = [];
for (const requirement of document.requirements) {
  const id = requirement.requirement_id;
  let nextStatus;
  let finding;
  if (partial.has(id)) {
    nextStatus = 'PARTIAL';
    finding = partial.get(id);
  } else if (blocked.has(id)) {
    nextStatus = 'BLOCKED_CLIENT';
    finding = blocked.get(id);
  } else if (notTestable.has(id)) {
    nextStatus = 'NOT_TESTABLE';
    finding = notTestable.get(id);
  } else if (missing.has(id)) {
    nextStatus = 'MISSING';
    finding =
      'La reauditoría no encontró una superficie y prueba React que implementen este comportamiento del video.';
  } else {
    continue;
  }
  const previousStatus = requirement.parity_status;
  requirement.parity_status = nextStatus;
  if (nextStatus === 'MISSING') requirement.functional_status = 'UNVERIFIED';
  if (id === 'CH03-F003' || id === 'CH03-F006') requirement.functional_status = 'UNVERIFIED';
  if (nextStatus === 'BLOCKED_CLIENT') {
    const ids = requirement.blocker_ids?.length
      ? requirement.blocker_ids
      : (requirement.open_question_ids ?? []);
    requirement.blocker_ids = ids.length ? ids : [`${id}-CLIENT-DEFINITION`];
    requirement.blocker_type = 'CLIENT_DEFINITION';
    requirement.blocker_reason = finding;
  }
  if (nextStatus === 'NOT_TESTABLE') {
    const ids = requirement.blocker_ids?.length
      ? requirement.blocker_ids
      : (requirement.open_question_ids ?? []);
    requirement.blocker_ids = ids.length ? ids : [`${id}-SOURCE-OUTCOME`];
    requirement.blocker_type = 'SOURCE_EVIDENCE';
    requirement.blocker_reason = finding;
  }
  requirement.last_verified_sha = artifactSha;
  const prefix = 'Reauditoría independiente 2026-09-10:';
  const baseNotes = String(requirement.notes ?? '').split(` ${prefix}`)[0];
  requirement.notes = `${baseNotes} ${prefix} ${finding}`.trim();
  changed.push({ requirement_id: id, from: previousStatus, to: nextStatus });
}

const counts = Object.fromEntries(
  [...new Set(document.requirements.map((item) => item.parity_status))]
    .sort()
    .map((status) => [
      status,
      document.requirements.filter((item) => item.parity_status === status).length,
    ]),
);
document.independent_reaudit_20260910 = {
  artifact_sha: artifactSha,
  scope:
    '17 capítulos, 210 requisitos; revisión de evidencia delegada en tres lotes read-only y consolidada por el escritor principal.',
  correction_count: 50,
  reviewed_requirements: document.requirements.length,
  parity_counts: counts,
  limitations:
    'No acredita Mongo en Preview, proveedores externos ni reglas clínicas, fiscales, tarifarias o de inventario no aprobadas.',
};
document.studio_verification.scope =
  'Las 210 solicitudes siguen trazadas. La reauditoría independiente degradó afirmaciones sobreclasificadas; los gates estructurales no equivalen a paridad funcional.';

await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
console.log(JSON.stringify(document.independent_reaudit_20260910));
