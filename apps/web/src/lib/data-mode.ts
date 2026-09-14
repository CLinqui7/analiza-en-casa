export type ServerDataMode = 'mongodb' | 'postgresql';
export function isServerDataMode(mode: unknown): mode is ServerDataMode {
  return mode === 'mongodb' || mode === 'postgresql';
}
export function configuredServerDataMode(): ServerDataMode {
  return process.env.NEXT_PUBLIC_DATA_MODE === 'postgresql' ? 'postgresql' : 'mongodb';
}
