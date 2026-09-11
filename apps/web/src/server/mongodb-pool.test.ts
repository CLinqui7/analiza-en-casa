import { afterEach, describe, expect, it, vi } from 'vitest';
const driver = vi.hoisted(() => ({
  connect: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  db: vi.fn(),
  options: [] as unknown[],
}));
vi.mock('mongodb', () => ({
  ServerApiVersion: { v1: '1' },
  MongoClient: class {
    constructor(_uri: string, options: unknown) {
      driver.options.push(options);
    }
    connect() {
      return driver.connect().then(() => this);
    }
    close() {
      return driver.close();
    }
    db(name: string) {
      return driver.db(name);
    }
  },
}));
import { closeMongoClient, mongoDatabase } from './mongodb';
const env = {
  ANALIZA_DATA_MODE: 'mongodb',
  MONGODB_URI: 'mongodb://test.invalid',
  MONGODB_DB: 'qa',
};
afterEach(async () => {
  await closeMongoClient();
  vi.clearAllMocks();
  driver.options.length = 0;
});
describe('Mongo process pool', () => {
  it('shares concurrent connections and bounds server-selection time', async () => {
    driver.connect.mockResolvedValue(undefined);
    await Promise.all([mongoDatabase(env), mongoDatabase(env)]);
    expect(driver.connect).toHaveBeenCalledTimes(1);
    expect(driver.options[0]).toMatchObject({ serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
  });
  it('retries a fresh pool after an outage instead of retaining a rejected promise', async () => {
    driver.connect
      .mockRejectedValueOnce(new Error('Synthetic connection outage'))
      .mockResolvedValueOnce(undefined);
    await expect(mongoDatabase(env)).rejects.toThrow('Synthetic connection outage');
    await mongoDatabase(env);
    expect(driver.connect).toHaveBeenCalledTimes(2);
    expect(driver.close).toHaveBeenCalledTimes(1);
  });
});
