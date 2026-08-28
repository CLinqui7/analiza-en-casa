import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { seedData } from "../app/mock-data.js";
import { paritySummary } from "../app/parity-summary.js";

test("BASE-P1-018: QA UI derives chapter totals from the generated canonical matrix", async () => {
  const [views, generator] = await Promise.all([
    readFile(new URL("../app/views.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate-exact-parity-matrices.mjs", import.meta.url), "utf8")
  ]);
  assert.equal(Object.hasOwn(seedData, "qaCoverage"), false);
  assert.equal(paritySummary.source, "docs/parity/EXACT_VIDEO_PARITY_MATRIX.json");
  assert.equal(paritySummary.chapters.length, 17);
  assert.equal(paritySummary.missing, 0);
  assert.match(views, /import \{ paritySummary \} from "\.\/parity-summary\.js"/);
  assert.match(views, /const coverage = paritySummary\.chapters/);
  assert.doesNotMatch(views, /state\.qaCoverage/);
  assert.match(generator, /await writeFile\(new URL\("parity-summary\.js", appDir\)/);
});
