import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const canonical = JSON.parse(await readFile(resolve(root, 'docs/MASTER_VIDEO_REQUIREMENTS.json'), 'utf8'));
const routes = JSON.parse(await readFile(resolve(root, 'docs/qa/REACT_ROUTE_PARITY.json'), 'utf8'));
const inventory = JSON.parse(await readFile(resolve(root, 'docs/qa/UI_ACTION_INVENTORY.json'), 'utf8'));
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const generatedAt = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

const chapterRoute = {
  CH01: 'ROUTE-PATIENTS', CH02: 'ROUTE-PATIENTS', CH03: 'ROUTE-HOSPITALIZATIONS', CH04: 'ROUTE-QUOTES', CH05: 'ROUTE-QUOTES', CH06: 'ROUTE-QUOTES', CH07: 'ROUTE-INSURANCE', CH08: 'ROUTE-RECEIVABLES', CH09: 'ROUTE-CLINICAL-HOSPITALIZATIONS', CH10: 'ROUTE-MEDICAL-ORDERS', CH11: 'ROUTE-AGENDA', CH12: 'ROUTE-NURSING-RESOURCES', CH13: 'ROUTE-PURCHASES', CH14: 'ROUTE-INVENTORY', CH15: 'ROUTE-CATALOGS', CH16: 'ROUTE-DISCOUNTS', CH17: 'ROUTE-CLINICAL-HOSPITALIZATIONS',
};
const ch01Actions = {
  'CH01-F001': ['PATIENT-NAVIGATE', 'AUTH-LOGIN'], 'CH01-F002': ['PATIENT-TAB-ACTIVE', 'PATIENT-TAB-INACTIVE', 'PATIENT-TAB-IMPORT', 'PATIENT-IMPORT'],
  'CH01-F003': ['PATIENT-DETAIL-NAVIGATE', 'PATIENT-BOTMAKER-CONSENT'], 'CH01-F004': ['PATIENT-SEARCH', 'PATIENT-PAGE-SIZE', 'PATIENT-PAGINATE', 'PATIENT-PAGE-PREVIOUS', 'PATIENT-PAGE-NEXT'],
  'CH01-F005': ['PATIENT-EXPORT-XLSX', 'PATIENT-CREATE'], 'CH01-F007': ['PATIENT-BOTMAKER-CONSENT'], 'CH01-F008': ['CLÍNICO-TOGGLE', 'INVENTARIO-TOGGLE', 'REPORTES-TOGGLE'],
  'CH01-F011': ['USER-MENU-OPEN', 'USER-MENU-CLOSE', 'USER-PROFILE-OPEN'], 'CH01-F012': ['AUTH-LOGOUT'], 'CH01-F013': ['AUTH-LOGIN-EMAIL', 'AUTH-LOGIN-PASSWORD', 'AUTH-LOGIN', 'AUTH-RECOVER-OPEN'], 'CH01-F014': ['AUTH-INSTALL'],
};
const status = (assessment) => ({ IMPLEMENTED_EXACT: 'EXACT', IMPLEMENTED_PARTIAL: 'PARTIAL', MISSING: 'MISSING', BLOCKED_CLIENT: 'BLOCKED_CLIENT', BLOCKED_INTEGRATION: 'BLOCKED_INTEGRATION', NOT_TESTABLE: 'NOT_TESTABLE' }[assessment.status] ?? 'NOT_TESTABLE');
const csv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const columns = ['requirement_id','chapter_id','feature','detailed_behavior','classification','priority','evidence_paths','open_question_ids','route_id','react_route','react_files','component_ids','action_ids','parity_status','functional_status','persistence_status','permissions_status','performance_status','unit_test_ids','playwright_test_ids','selenium_test_ids','visual_test_ids','blocker_type','blocker_ids','blocker_reason','last_verified_sha','notes'];

function filesFor(route) {
  return (route?.evidence ?? []).filter((value) => value.startsWith('apps/web/'));
}
function actionTests(ids) {
  const matching = inventory.actions.filter((action) => ids.includes(action.action_id));
  return {
    unit: matching.flatMap((action) => action.unit_test_ids ?? []),
    playwright: matching.flatMap((action) => action.playwright_test_ids ?? []),
    selenium: matching.flatMap((action) => action.selenium_test_ids ?? []),
  };
}

const requirements = canonical.requirements.map((requirement) => {
  const route = routes.routes.find((candidate) => candidate.route_id === chapterRoute[requirement.chapter_id]);
  const parityStatus = status(requirement.platform_assessment);
  const actionIds = ch01Actions[requirement.requirement_id] ?? [];
  const tests = actionTests(actionIds);
  const blocker = parityStatus.startsWith('BLOCKED') || parityStatus === 'NOT_TESTABLE';
  return {
    requirement_id: requirement.requirement_id, chapter_id: requirement.chapter_id, feature: requirement.feature,
    detailed_behavior: requirement.detailed_behavior, classification: requirement.classification,
    priority: requirement.platform_assessment.priority, evidence_paths: requirement.evidence.flatMap((item) => [item.path, item.detail_path].filter(Boolean)),
    open_question_ids: requirement.open_question_ids, route_id: route?.route_id ?? null, react_route: route?.react_route ?? null,
    react_files: filesFor(route), component_ids: [], action_ids: actionIds, parity_status: parityStatus,
    functional_status: parityStatus === 'EXACT' ? 'VERIFIED' : 'UNVERIFIED', persistence_status: 'UNVERIFIED', permissions_status: 'UNVERIFIED', performance_status: 'UNVERIFIED',
    unit_test_ids: tests.unit, playwright_test_ids: tests.playwright, selenium_test_ids: tests.selenium, visual_test_ids: [],
    blocker_type: blocker ? parityStatus : null, blocker_ids: blocker ? requirement.open_question_ids : [],
    blocker_reason: blocker ? requirement.platform_assessment.notes : null, last_verified_sha: sha,
    notes: `Estado recalculado desde MASTER_VIDEO_REQUIREMENTS y superficies React; certificación de acciones y paridad completa son conceptos separados.`,
  };
});

const output = { schema_version: 1, generated_at: generatedAt, source_sha: sha, source_sha256: createHash('sha256').update(JSON.stringify(canonical.requirements)).digest('hex'), requirements };
const summary = requirements.reduce((result, item) => { result[item.parity_status] += 1; return result; }, {
  total: requirements.length, EXACT: 0, PARTIAL: 0, MISSING: 0, BLOCKED_CLIENT: 0, BLOCKED_INTEGRATION: 0, NOT_TESTABLE: 0, NOT_APPLICABLE: 0,
});
const correctedRoutes = {
  ...routes,
  generated_at: generatedAt,
  routes: routes.routes.map((route) => {
    const related = requirements.filter((item) => item.route_id === route.route_id);
    const hasOpen = related.some((item) => ['PARTIAL', 'MISSING'].includes(item.parity_status));
    const full_video_parity_status = hasOpen ? 'PARTIAL' : related.length && related.every((item) => item.parity_status === 'EXACT') ? 'EXACT' : 'NOT_TESTABLE';
    return {
      ...route,
      route_action_certified_at_sha: route.route_action_certified_at_sha ?? (route.status === 'MIGRATED_EXACT' ? sha : null),
      full_video_parity_status,
      status: route.status === 'MIGRATED_EXACT' && full_video_parity_status !== 'EXACT' ? 'MIGRATED_PARTIAL' : route.status,
    };
  }),
};
const markdown = ['# Trazabilidad video → React → prueba', '', '> Generado de forma determinista. El estado de paridad no certifica una ruta sólo por tener acciones.', '', `SHA fuente: \`${sha}\``, '', '| Requisito | Ruta | Estado | Acciones |', '|---|---|---|---|', ...requirements.map((item) => `| ${item.requirement_id} | ${item.react_route ?? 'Sin ruta'} | ${item.parity_status} | ${item.action_ids.join(', ') || '—'} |`), ''].join('\n');
const values = (item) => columns.map((column) => csv(Array.isArray(item[column]) ? item[column].join('|') : item[column])).join(',');
const appSummary = `// Generated by qa:video-parity:generate. Do not edit manually.\nexport const videoParitySummary = ${JSON.stringify({ generatedAt, sourceSha: sha, chapters: canonical.chapters.length, ...summary }, null, 2)} as const;\n`;

await Promise.all([
  writeFile(resolve(root, 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.json'), `${JSON.stringify(output, null, 2)}\n`),
  writeFile(resolve(root, 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.csv'), `${columns.join(',')}\n${requirements.map(values).join('\n')}\n`),
  writeFile(resolve(root, 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.md'), markdown),
  writeFile(resolve(root, 'apps/web/src/lib/video-parity-summary.ts'), appSummary),
  writeFile(resolve(root, 'docs/qa/REACT_ROUTE_PARITY.json'), `${JSON.stringify(correctedRoutes, null, 2)}\n`),
]);
console.log(JSON.stringify({ requirements: requirements.length, summary, sha }, null, 2));
