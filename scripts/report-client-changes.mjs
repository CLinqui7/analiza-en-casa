import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd();
const registry = JSON.parse(readFileSync(resolve(root, 'docs/qa/CLIENT_CHANGE_REQUESTS.json'), 'utf8'));
const counts = registry.changes.reduce((result, change) => ({ ...result, [change.status]: (result[change.status] ?? 0) + 1 }), {});
const conflicts = registry.changes.filter((change) => change.source_conflict.detected);
const report = ['# Reporte de cambios del cliente', '', `Fuente: \`${registry.canonical_source.path}\``, `SHA-256 fuente: \`${registry.canonical_source.sha256}\``, `HEAD auditado: \`${registry.canonical_source.source_head}\``, '', '## Estado', '', '| Estado | Cantidad |', '|---|---:|', ...Object.entries(counts).map(([status, count]) => `| ${status} | ${count} |`), '', '## Confirmaciones requeridas', '', ...conflicts.map((change) => `- ${change.change_id}: ${change.source_conflict.detail} ${change.client_question ?? ''}`), '', 'Los estados DEMO no se presentan como implementación multiusuario o productiva. Las escalas clínicas permanecen sin certificar hasta versión institucional aprobada.', ''].join('\n');
writeFileSync(resolve(root, 'docs/qa/CLIENT_CHANGE_REPORT.md'), report);
console.log(JSON.stringify({ changes_total: registry.changes.length, counts, report: 'docs/qa/CLIENT_CHANGE_REPORT.md' }, null, 2));
