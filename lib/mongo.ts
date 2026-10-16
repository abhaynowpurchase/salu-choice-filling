import { MongoClient, Db } from 'mongodb';

const uri = process.env.DATABASE_URL;
const dbName = process.env.DB_NAME || 'salu_choice_filling';

// Reuse one client across hot reloads and serverless invocations.
const g = globalThis as unknown as { _mongo?: Promise<MongoClient> };

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error('DATABASE_URL is not set');
  if (!g._mongo) g._mongo = new MongoClient(uri).connect();
  const client = await g._mongo;
  return client.db(dbName);
}

export async function getClient(): Promise<MongoClient> {
  await getDb();
  return g._mongo as Promise<MongoClient>;
}

export const TABS = ['dch', 'pd'] as const;
export type Tab = (typeof TABS)[number];
export const isTab = (t: string): t is Tab => (TABS as readonly string[]).includes(t);
