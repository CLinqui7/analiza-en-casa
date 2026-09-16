import { migrateMongo, migrationPlan } from './mongo-migrations.mjs';

try {
  if (process.argv.includes('--dry-run')) {
    console.log(
      JSON.stringify({
        operation: 'PLAN_ONLY',
        migrations: (await migrationPlan()).map(({ version, sha256, indexes }) => ({
          version,
          sha256,
          indexes: indexes.length,
        })),
      }),
    );
  } else if (process.argv.includes('--migrate')) {
    console.log(JSON.stringify(await migrateMongo()));
  } else {
    throw new Error('Specify --dry-run or --migrate');
  }
} catch {
  // Driver errors can contain connection information. Keep credentials out of CI logs.
  console.error(
    'MongoDB migration FAILED. Deployment must stop. Check private configuration, migration lock and immutable checksums.',
  );
  process.exitCode = 1;
}
