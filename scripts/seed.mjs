// Loads data/options.json into MongoDB (options collection) and creates indexes.
// Usage: npm run seed   (reads DATABASE_URL from .env)
import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';

for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const docs = JSON.parse(readFileSync(new URL('../data/options.json', import.meta.url), 'utf8'));
const client = await new MongoClient(process.env.DATABASE_URL).connect();
const db = client.db(process.env.DB_NAME || 'salu_choice_filling');
await db.collection('options').bulkWrite(docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })));
await db.collection('options').createIndex({ tab: 1 });
await db.collection('preferences').createIndex({ tab: 1, number: 1 }, { unique: true });
await db.collection('preferences').createIndex({ tab: 1, option_id: 1 }, { unique: true });
console.log(`Seeded ${docs.length} options`);
await client.close();
