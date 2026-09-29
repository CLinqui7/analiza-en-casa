import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/extract-studio-scale-images.mjs <studio-html>');

const html = await readFile(source, 'utf8');
const line = html.split(/\r?\n/).find((entry) => entry.startsWith('const SOURCE_IMAGES='));
if (!line) throw new Error('SOURCE_IMAGES was not found in the supplied Studio HTML.');
const images = JSON.parse(line.slice('const SOURCE_IMAGES='.length).replace(/;\s*$/, ''));
const originals = [
  [22, 16],
  [23, 17],
  [24, 18],
  [25, 19],
  [26, 20],
  [27, 21],
  [28, 22],
  [29, 24],
  [30, 25],
  [31, 23],
];
const destination = path.resolve('apps/web/public/reference-scales');
await mkdir(destination, { recursive: true });
for (const [row, number] of originals) {
  const dataUrl = images[`image${number}.png`];
  if (!dataUrl?.startsWith('data:image/png;base64,')) {
    throw new Error(`Missing PNG for Hoja1 row ${row} (image${number}.png).`);
  }
  const bytes = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  const file = path.join(destination, `hoja1-fila-${row}.png`);
  await writeFile(file, bytes);
  console.log(`${path.basename(file)}: ${bytes.length} bytes`);
}
