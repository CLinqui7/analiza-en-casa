import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const data = JSON.parse(await readFile(resolve('docs/qa/VIDEO_TO_REACT_TRACEABILITY.json'), 'utf8'));
const counts = data.requirements.reduce((result, item) => ({ ...result, [item.parity_status]: (result[item.parity_status] ?? 0) + 1 }), {});
console.log(JSON.stringify({ generated_at: data.generated_at, source_sha: data.source_sha, total: data.requirements.length, counts }, null, 2));
