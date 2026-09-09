import { mongoAuthIndexes } from './mongo-auth';
import { mongoFileMetadataIndexes } from './mongo-files';
import { mongoFinancialIndexes } from './mongo-financial';
import { mongoDoctorIndexes } from './mongo-doctors';
import { mongoHospitalizationIndexes } from './mongo-hospitalizations';
import { mongoPatientIndexes } from './mongo-patients';
import { mongoQuoteIndexes } from './mongo-quotes';
import { mongoPortalIndexes } from './mongo-portal';
import { mongoShiftIndexes } from './mongo-shifts';

type IndexDefinition = {
  collection: string;
  key: Record<string, number>;
  name: string;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
  expireAfterSeconds?: number;
};

type BootstrapDatabase = {
  collection(name: string): {
    createIndex(
      key: Record<string, number>,
      options: Omit<IndexDefinition, 'collection' | 'key'>,
    ): Promise<string>;
  };
};

export const mongoSchemaIndexes: readonly IndexDefinition[] = [
  ...mongoAuthIndexes,
  ...mongoPatientIndexes,
  ...mongoDoctorIndexes,
  ...mongoHospitalizationIndexes,
  ...mongoShiftIndexes,
  ...mongoQuoteIndexes,
  ...mongoPortalIndexes,
  ...mongoFinancialIndexes,
  ...mongoFileMetadataIndexes,
];

export type MongoBootstrapReport = Readonly<{
  dryRun: boolean;
  plannedIndexes: readonly string[];
  appliedIndexes: readonly string[];
}>;

/**
 * Deployment-only schema initialization. MongoDB `createIndex` is idempotent when the named
 * definition is unchanged; dry-run makes every planned index visible without changing a database.
 * It is intentionally not imported by request handlers.
 */
export async function initializeMongoSchema(
  database: BootstrapDatabase,
  options: Readonly<{ dryRun: boolean }>,
): Promise<MongoBootstrapReport> {
  const plannedIndexes = mongoSchemaIndexes.map(({ collection, name }) => `${collection}.${name}`);
  if (options.dryRun) return { dryRun: true, plannedIndexes, appliedIndexes: [] };
  const appliedIndexes: string[] = [];
  for (const {
    collection,
    key,
    name,
    unique,
    partialFilterExpression,
    expireAfterSeconds,
  } of mongoSchemaIndexes) {
    await database.collection(collection).createIndex(key, {
      name,
      ...(unique ? { unique } : {}),
      ...(partialFilterExpression ? { partialFilterExpression } : {}),
      ...(typeof expireAfterSeconds === 'number' ? { expireAfterSeconds } : {}),
    });
    appliedIndexes.push(`${collection}.${name}`);
  }
  return { dryRun: false, plannedIndexes, appliedIndexes };
}
