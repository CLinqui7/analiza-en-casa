import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ch01FunctionalFingerprint } from './functional-fingerprint.mjs';

const root = process.cwd();
const canonical = JSON.parse(await readFile(resolve(root, 'docs/MASTER_VIDEO_REQUIREMENTS.json'), 'utf8'));
const routes = JSON.parse(await readFile(resolve(root, 'docs/qa/REACT_ROUTE_PARITY.json'), 'utf8'));
const inventory = JSON.parse(await readFile(resolve(root, 'docs/qa/UI_ACTION_INVENTORY.json'), 'utf8'));
const certificationPath = resolve(root, 'docs/qa/VIDEO_REQUIREMENT_CERTIFICATIONS.json');
const certificationDocument = existsSync(certificationPath) ? JSON.parse(await readFile(certificationPath, 'utf8')) : { certifications: {} };
const certifications = certificationDocument.certifications ?? certificationDocument;
const traceabilityPath = resolve(root, 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.json');
const existingTraceability = existsSync(traceabilityPath) ? JSON.parse(await readFile(traceabilityPath, 'utf8')) : { requirements: [] };
const reviewedRequirements = new Map((existingTraceability.requirements ?? []).map((item) => [item.requirement_id, item]));
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const generatedAt = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const functionalFingerprint = ch01FunctionalFingerprint(root);

const chapterRoute = {
  CH01: 'ROUTE-PATIENTS', CH02: 'ROUTE-PATIENTS', CH03: 'ROUTE-HOSPITALIZATIONS', CH04: 'ROUTE-QUOTES', CH05: 'ROUTE-QUOTES', CH06: 'ROUTE-QUOTES', CH07: 'ROUTE-INSURANCE', CH08: 'ROUTE-RECEIVABLES', CH09: 'ROUTE-CLINICAL-HOSPITALIZATIONS', CH10: 'ROUTE-MEDICAL-ORDERS', CH11: 'ROUTE-AGENDA', CH12: 'ROUTE-PAYABLES', CH13: 'ROUTE-PURCHASES', CH14: 'ROUTE-INVENTORY', CH15: 'ROUTE-CATALOGS', CH16: 'ROUTE-DISCOUNTS', CH17: 'ROUTE-CLINICAL-HOSPITALIZATIONS',
};
const ch01Actions = {
  'CH01-F001': ['PATIENT-NAVIGATE', 'AUTH-LOGIN'], 'CH01-F002': ['PATIENT-TAB-ACTIVE', 'PATIENT-TAB-INACTIVE', 'PATIENT-TAB-IMPORT', 'PATIENT-IMPORT'],
  'CH01-F003': ['PATIENT-DETAIL-NAVIGATE', 'PATIENT-BOTMAKER-CONSENT'], 'CH01-F004': ['PATIENT-SEARCH', 'PATIENT-PAGE-SIZE', 'PATIENT-PAGINATE', 'PATIENT-PAGE-PREVIOUS', 'PATIENT-PAGE-NEXT'],
  'CH01-F005': ['PATIENT-EXPORT-XLSX', 'PATIENT-EXPORT-CSV', 'PATIENT-CREATE'], 'CH01-F007': ['PATIENT-BOTMAKER-CONSENT'], 'CH01-F008': [],
  'CH01-F011': ['USER-MENU-OPEN', 'USER-MENU-CLOSE', 'USER-PROFILE-OPEN'], 'CH01-F012': ['AUTH-LOGOUT'], 'CH01-F013': ['AUTH-LOGIN-EMAIL', 'AUTH-LOGIN-PASSWORD', 'AUTH-LOGIN', 'AUTH-RECOVER-OPEN'], 'CH01-F014': ['AUTH-INSTALL'],
  'CH02-F001': ['AUTH-LOGIN', 'PATIENT-NAVIGATE'], 'CH02-F002': ['PATIENT-TAB-ACTIVE', 'PATIENT-TAB-INACTIVE', 'PATIENT-TAB-IMPORT', 'PATIENT-EXPORT-XLSX', 'PATIENT-CREATE'],
  'CH02-F004': ['PATIENT-DOCUMENT-TYPE'], 'CH02-F005': ['PATIENT-DOCUMENT-TYPE'], 'CH02-F006': ['PATIENT-NATIONALITY-SEARCH', 'PATIENT-COMPANY-SEARCH'], 'CH02-F007': ['PATIENT-BOTMAKER-CONSENT'],
  'CH02-F008': ['PATIENT-INSURANCE-TOGGLE'], 'CH02-F009': ['PATIENT-INSURER-SEARCH'], 'CH02-F011': ['PATIENT-INSURANCE-HOLDER-YES', 'PATIENT-INSURANCE-HOLDER-NO', 'PATIENT-INSURANCE-HOLDER-CANCEL'],
  'CH02-F012': ['PATIENT-COVERAGE-ADD'], 'CH02-F013': ['PATIENT-CONTACT-ADD', 'PATIENT-CONTACT-REMOVE', 'PATIENT-CONTACT-PRIMARY'], 'CH02-F014': ['PATIENT-ADDRESS-IMPORT', 'PATIENT-ADDRESS-INFO', 'PATIENT-ADDRESS-CLEAR'],
  'CH02-F015': ['PATIENT-MAP-ZOOM-IN', 'PATIENT-MAP-ZOOM-OUT', 'PATIENT-MAP-LAYER', 'PATIENT-MAP-FULLSCREEN', 'PATIENT-MAP-MARKER'], 'CH02-F016': ['PATIENT-BACK', 'PATIENT-SAVE'],
};
const status = (assessment) => ({ IMPLEMENTED_EXACT: 'EXACT', IMPLEMENTED_PARTIAL: 'PARTIAL', MISSING: 'MISSING', BLOCKED_CLIENT: 'BLOCKED_CLIENT', BLOCKED_INTEGRATION: 'BLOCKED_INTEGRATION', NOT_TESTABLE: 'NOT_TESTABLE' }[assessment.status] ?? 'NOT_TESTABLE');
const csv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const columns = ['requirement_id','chapter_id','feature','detailed_behavior','classification','priority','evidence_paths','open_question_ids','route_id','react_route','react_files','component_ids','action_ids','parity_status','functional_status','persistence_status','permissions_status','performance_status','unit_test_ids','playwright_test_ids','selenium_test_ids','visual_test_ids','blocker_type','blocker_ids','blocker_reason','last_verified_sha','functional_fingerprint','notes'];
const reviewedMetadataFields = [
  'open_question_ids', 'route_id', 'react_route', 'react_files', 'component_ids', 'action_ids',
  'parity_status', 'functional_status', 'persistence_status', 'permissions_status', 'performance_status',
  'unit_test_ids', 'playwright_test_ids', 'selenium_test_ids', 'visual_test_ids', 'blocker_type',
  'blocker_ids', 'blocker_reason', 'last_verified_sha', 'notes',
];

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
  const certification = certifications[requirement.requirement_id];
  const parityStatus = certification?.parity_status ?? status(requirement.platform_assessment);
  const actionIds = certification?.action_ids ?? ch01Actions[requirement.requirement_id] ?? [];
  const tests = actionTests(actionIds);
  const blocker = parityStatus.startsWith('BLOCKED') || parityStatus === 'NOT_TESTABLE';
  const generated = {
    requirement_id: requirement.requirement_id, chapter_id: requirement.chapter_id, feature: requirement.feature,
    detailed_behavior: requirement.detailed_behavior, classification: requirement.classification,
    priority: requirement.platform_assessment.priority, evidence_paths: requirement.evidence.flatMap((item) => [item.path, item.detail_path].filter(Boolean)),
    open_question_ids: requirement.open_question_ids, route_id: route?.route_id ?? null, react_route: route?.react_route ?? null,
    react_files: filesFor(route), component_ids: certification?.component_ids ?? [], action_ids: actionIds, parity_status: parityStatus,
    functional_status: certification?.functional_status ?? (parityStatus === 'EXACT' ? 'VERIFIED' : 'UNVERIFIED'), persistence_status: certification?.persistence_status ?? 'UNVERIFIED', permissions_status: certification?.permissions_status ?? 'UNVERIFIED', performance_status: certification?.performance_status ?? 'UNVERIFIED',
    unit_test_ids: certification ? (certification.unit_test_ids ?? []) : tests.unit, playwright_test_ids: certification ? (certification.playwright_test_ids ?? []) : tests.playwright, selenium_test_ids: certification ? (certification.selenium_test_ids ?? []) : tests.selenium, visual_test_ids: certification ? (certification.visual_test_ids ?? []) : [],
    blocker_type: certification?.blocker_type ?? (blocker ? parityStatus : null), blocker_ids: certification?.blocker_ids ?? (blocker ? requirement.open_question_ids : []),
    blocker_reason: certification?.blocker_reason ?? (blocker ? requirement.platform_assessment.notes : null), last_verified_sha: certification?.last_verified_sha ?? certification?.implementation_sha ?? certificationDocument.implementation_sha ?? null,
    notes: certification?.notes ?? `Estado inicial desde MASTER_VIDEO_REQUIREMENTS; falta certificación actual independiente.`,
  };
  const reviewed = reviewedRequirements.get(requirement.requirement_id);
  if (!reviewed) return generated;
  const preserved = Object.fromEntries(reviewedMetadataFields
    .filter((field) => Object.hasOwn(reviewed, field))
    .map((field) => [field, reviewed[field]]));
  const certified = Object.fromEntries(reviewedMetadataFields
    .filter((field) => certification && Object.hasOwn(certification, field))
    .map((field) => [field, certification[field]]));
  return { ...generated, ...preserved, ...certified };
});

const output = { schema_version: 2, generated_at: generatedAt, metadata_generated_from_commit: sha, source_sha256: createHash('sha256').update(JSON.stringify(canonical.requirements)).digest('hex'), implementation_sha: certificationDocument.implementation_sha ?? null, functional_fingerprint: functionalFingerprint, requirements };
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
const markdown = ['# Trazabilidad video → React → prueba', '', '> Generado de forma determinista. La validez de CH01 depende de su fingerprint funcional, no del commit que contiene esta metadata.', '', `Commit generador: \`${sha}\``, `SHA de implementación: \`${certificationDocument.implementation_sha ?? 'pendiente'}\``, `Fingerprint funcional CH01: \`${functionalFingerprint}\``, '', '| Requisito | Ruta | Estado | Acciones |', '|---|---|---|---|', ...requirements.map((item) => `| ${item.requirement_id} | ${item.react_route ?? 'Sin ruta'} | ${item.parity_status} | ${item.action_ids.join(', ') || '—'} |`), ''].join('\n');
const values = (item) => columns.map((column) => {
  const value = column === 'functional_fingerprint' ? functionalFingerprint : item[column];
  return csv(Array.isArray(value) ? value.join('|') : value);
}).join(',');
const appSummaryPayload = JSON.stringify({ generatedAt, sourceSha: certificationDocument.implementation_sha ?? null, functionalFingerprint, chapters: canonical.chapters.length, ...summary }, null, 2);
const appSummary = `// Generated by qa:video-parity:generate. Do not edit manually.\nexport const videoParitySummary = ${appSummaryPayload.replace(/"sourceSha": (null|"[^"]*")/, '"sourceSha": $1 as string | null')} as const;\n`;

await Promise.all([
  writeFile(resolve(root, 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.json'), `${JSON.stringify(output, null, 2)}\n`),
  writeFile(resolve(root, 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.csv'), `${columns.join(',')}\n${requirements.map(values).join('\n')}\n`),
  writeFile(resolve(root, 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.md'), markdown),
  writeFile(resolve(root, 'apps/web/src/lib/video-parity-summary.ts'), appSummary),
  writeFile(resolve(root, 'docs/qa/REACT_ROUTE_PARITY.json'), `${JSON.stringify(correctedRoutes, null, 2)}\n`),
]);
console.log(JSON.stringify({ requirements: requirements.length, summary, sha }, null, 2));
