import { MongoClient, ServerApiVersion, type Db } from 'mongodb';

export type MongoRuntimeConfig = Readonly<{ uri: string; database: string }>;
export type MongoEnvironment = Readonly<{
  ANALIZA_DATA_MODE?: string;
  MONGODB_URI?: string;
  MONGODB_DB?: string;
}>;

export class MongoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MongoConfigurationError';
  }
}

/** Configuration stays in Node-only environment variables and never crosses to the browser. */
export function mongoRuntimeConfig(
  environment: MongoEnvironment = process.env as MongoEnvironment,
): MongoRuntimeConfig {
  if (environment.ANALIZA_DATA_MODE !== 'mongodb') {
    throw new MongoConfigurationError(
      'El modo de datos del servidor no está configurado para MongoDB.',
    );
  }
  const uri = environment.MONGODB_URI;
  const database = environment.MONGODB_DB;
  if (!uri || !database) {
    throw new MongoConfigurationError('La configuración segura de MongoDB no está completa.');
  }
  return { uri, database };
}

type MongoGlobal = typeof globalThis & { __analizaMongoClientPromise?: Promise<MongoClient> };

function clientFor(config: MongoRuntimeConfig): Promise<MongoClient> {
  const globalMongo = globalThis as MongoGlobal;
  if (!globalMongo.__analizaMongoClientPromise) {
    const client = new MongoClient(config.uri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    });
    globalMongo.__analizaMongoClientPromise = client.connect();
  }
  return globalMongo.__analizaMongoClientPromise;
}

/** Reuses one driver-managed pool per Node process; it never creates schema in a request. */
export async function mongoDatabase(
  environment: MongoEnvironment = process.env as MongoEnvironment,
): Promise<Db> {
  const config = mongoRuntimeConfig(environment);
  const client = await clientFor(config);
  return client.db(config.database);
}

/** Deployment commands close their pool explicitly; request handlers retain the pooled client. */
export async function closeMongoClient(): Promise<void> {
  const globalMongo = globalThis as MongoGlobal;
  const clientPromise = globalMongo.__analizaMongoClientPromise;
  globalMongo.__analizaMongoClientPromise = undefined;
  if (clientPromise) await (await clientPromise).close();
}
