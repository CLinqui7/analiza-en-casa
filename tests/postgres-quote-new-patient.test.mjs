import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL(
    '../database/postgresql/migrations/021_quotes_without_hospitalization.sql',
    import.meta.url,
  ),
  'utf8',
);
const repository = await readFile(
  new URL('../apps/web/src/server/persistence/postgres-quotes.ts', import.meta.url),
  'utf8',
);

test('new-patient quotes keep patient integrity while allowing no hospitalization', () => {
  assert.match(migration, /ALTER COLUMN case_id DROP NOT NULL/);
  assert.match(migration, /case_id IS NULL AND NOT body \? 'caseId'/);
  assert.match(migration, /FOREIGN KEY \(organization_id,case_id\)/);
  assert.match(repository, /FROM analiza\.patients WHERE organization_id=\$1 AND id=\$2/);
  assert.match(repository, /if \(quote\.caseId\)/);
  assert.match(repository, /stored\.caseId \?\? null/);
});

test('draft replacement cannot silently switch patient or hospitalization identity', async () => {
  assert.match(repository, /hasSameQuoteVersionIdentity\(currentQuote, quote\)/);
  const domain = await readFile(new URL('../packages/domain/src/index.ts', import.meta.url), 'utf8');
  assert.match(domain, /\['patientId', 'caseId', 'version', 'rootQuoteId', 'originalQuoteId', 'createdAt'\]/);
  assert.match(repository, /previousQuote\.patientId !== quote\.patientId/);
  assert.match(repository, /previousQuote\.caseId !== quote\.caseId/);
});
