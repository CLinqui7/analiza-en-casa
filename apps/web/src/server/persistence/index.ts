import type { Persistence } from './contracts';

/** Lazy factories: building Next never connects to a database. Unknown modes always fail closed. */
export async function persistence(): Promise<Persistence> {
  if (process.env.ANALIZA_DATA_MODE === 'postgresql') {
    return (await import('./postgres')).postgresPersistence();
  }
  if (process.env.ANALIZA_DATA_MODE === 'mongodb') {
    return (await import('./mongo')).mongoPersistence();
  }
  throw new Error('La persistencia segura no está configurada.');
}
