import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const sourceRoot = resolve(root, 'apps/web');
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory() && !['.next', 'test-results', 'node_modules'].includes(entry.name)) walk(path);
    else if (/\.(?:ts|tsx|css)$/.test(entry.name)) files.push(path);
  }
}
walk(sourceRoot);
const forbidden = [
  { expression: /next-themes/i, label: 'next-themes' },
  { expression: /(?:^|[\s"'`])dark:/m, label: 'Tailwind dark variant' },
  { expression: /prefers-color-scheme\s*:\s*dark/i, label: 'dark media query' },
  { expression: /color-scheme\s*:\s*dark/i, label: 'dark color scheme' },
  { expression: /ThemeProvider|theme switcher|modo oscuro|dark mode/i, label: 'theme switching support' },
];
const failures = files.flatMap((path) => {
  const content = readFileSync(path, 'utf8');
  return forbidden.filter((rule) => rule.expression.test(content)).map((rule) => `${path.replace(`${root}\\`, '')}: ${rule.label}`);
});
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`light-mode gate passed: ${files.length} product source files contain no Dark/System UI support.`);
