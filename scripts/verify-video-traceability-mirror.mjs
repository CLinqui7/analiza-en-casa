import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const touchedRequirementIds = ['CH04-F004', 'CH09-F01', 'CH09-F02', 'CH14-F12', 'CH14-F13', 'CH14-F14', 'CH14-F15', 'CH14-F16', 'CH15-F06', 'CH15-F08', 'CH15-F09', 'CH15-F10', 'CH15-F13', 'CH15-F14', 'CH16-F01', 'CH16-F08', 'CH17-F01', 'CH17-F02'];
const traceabilityPath = resolve(root, 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.json');
const certificationPath = resolve(root, 'docs/qa/VIDEO_REQUIREMENT_CERTIFICATIONS.json');
const csvPath = resolve(root, 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.csv');

function parseCsv(source) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((row) => row.some((value) => value !== ''));
}

function serialized(value) {
  if (Array.isArray(value)) return value.join('|');
  return value == null ? '' : String(value);
}

function duplicateCertificationRequirementKeys(source) {
  const counts = new Map();
  for (const match of source.matchAll(/"(CH\d{2}-F\d+)"\s*:/g)) {
    const requirementId = match[1];
    counts.set(requirementId, (counts.get(requirementId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([requirementId]) => requirementId);
}

function verify({ traceability, certifications, rows }) {
  const errors = [];
  const [header, ...dataRows] = rows;
  if (!header?.length) return ['The traceability CSV is empty.'];
  const expectedColumns = [
    'requirement_id', 'chapter_id', 'feature', 'detailed_behavior', 'classification', 'priority',
    'evidence_paths', 'open_question_ids', 'route_id', 'react_route', 'react_files', 'component_ids',
    'action_ids', 'parity_status', 'functional_status', 'persistence_status', 'permissions_status',
    'performance_status', 'unit_test_ids', 'playwright_test_ids', 'selenium_test_ids', 'visual_test_ids',
    'blocker_type', 'blocker_ids', 'blocker_reason', 'last_verified_sha', 'functional_fingerprint', 'notes',
  ];
  for (const column of expectedColumns) {
    if (!header.includes(column)) errors.push(`CSV header is missing ${column}.`);
  }
  if (traceability.functional_fingerprint !== certifications.functional_fingerprint) {
    errors.push('Traceability and certification functional fingerprints differ.');
  }

  for (const requirementId of touchedRequirementIds) {
    const requirement = traceability.requirements.find((item) => item.requirement_id === requirementId);
    const matches = dataRows.filter((row) => row[header.indexOf('requirement_id')] === requirementId);
    const certification = certifications.certifications?.[requirementId];
    if (!requirement) {
      errors.push(`${requirementId} is missing from traceability JSON.`);
      continue;
    }
    if (matches.length !== 1) {
      errors.push(`${requirementId} must have exactly one CSV row (found ${matches.length}).`);
      continue;
    }
    const row = matches[0];
    for (const column of expectedColumns) {
      const index = header.indexOf(column);
      if (index < 0) continue;
      const expected = column === 'functional_fingerprint'
        ? traceability.functional_fingerprint
        : serialized(requirement[column]);
      if (row[index] !== expected) {
        errors.push(`${requirementId}.${column} differs between JSON and CSV.`);
      }
    }
    if (!certification) {
      errors.push(`${requirementId} is missing from certifications.`);
      continue;
    }
    for (const field of ['parity_status', 'functional_status', 'persistence_status', 'permissions_status', 'performance_status', 'playwright_test_ids', 'selenium_test_ids', 'blocker_ids']) {
      if (serialized(requirement[field]) !== serialized(certification[field])) {
        errors.push(`${requirementId}.${field} differs between traceability and certification.`);
      }
    }
  }
  return errors;
}

const traceability = JSON.parse(readFileSync(traceabilityPath, 'utf8'));
const rawCertifications = readFileSync(certificationPath, 'utf8');
const duplicateCertificationKeys = duplicateCertificationRequirementKeys(rawCertifications);
if (duplicateCertificationKeys.length) {
  console.error(`Certification verification failed: duplicate raw requirement key(s): ${duplicateCertificationKeys.join(', ')}.`);
  process.exit(1);
}
const certifications = JSON.parse(rawCertifications);
const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const errors = verify({ traceability, certifications, rows });

if (process.argv.includes('--self-test')) {
  const duplicateFixture = '{"certifications":{"CH15-F09":{},"CH15-F09":{}}}';
  if (!duplicateCertificationRequirementKeys(duplicateFixture).includes('CH15-F09')) {
    errors.push('Duplicate-certification anti-drift fixture was not detected before JSON parsing.');
  }

  const actionStatusRows = rows.map((row) => [...row]);
  const [header] = actionStatusRows;
  const requirementIndex = header.indexOf('requirement_id');
  const actionIndex = header.indexOf('action_ids');
  const statusIndex = header.indexOf('parity_status');
  const ch09Row = actionStatusRows.find((row) => row[requirementIndex] === 'CH09-F01');
  if (actionIndex < 0 || statusIndex < 0 || !ch09Row) {
    errors.push('Action/status anti-drift fixture is unavailable.');
  } else {
    ch09Row[actionIndex] = 'UNEXPECTED-ACTION';
    ch09Row[statusIndex] = 'EXACT';
    const negativeErrors = verify({ traceability, certifications, rows: actionStatusRows });
    for (const expected of ['CH09-F01.action_ids differs between JSON and CSV.', 'CH09-F01.parity_status differs between JSON and CSV.']) {
      if (!negativeErrors.includes(expected)) errors.push(`Action/status anti-drift fixture was not detected: ${expected}`);
    }
  }

  const csvMismatchRows = rows.map((row) => [...row]);
  const notesIndex = csvMismatchRows[0].indexOf('notes');
  const ch04Row = csvMismatchRows.find((row) => row[requirementIndex] === 'CH04-F004');
  if (notesIndex < 0 || !ch04Row) {
    errors.push('CSV anti-drift fixture is unavailable.');
  } else {
    ch04Row[notesIndex] = `${ch04Row[notesIndex]} [tampered]`;
    const negativeErrors = verify({ traceability, certifications, rows: csvMismatchRows });
    if (!negativeErrors.includes('CH04-F004.notes differs between JSON and CSV.')) {
      errors.push('CSV anti-drift fixture was not detected.');
    }
  }
}

if (errors.length) {
  console.error(`Traceability mirror verification failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Traceability mirror verified: ${touchedRequirementIds.join(', ')} JSON/CSV/certification records are consistent${process.argv.includes('--self-test') ? '; action/status, CSV, and duplicate-certification-key anti-drift self-tests passed' : ''}.`);
