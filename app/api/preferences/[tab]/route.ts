import { NextResponse } from 'next/server';
import { getClient, getDb, isTab } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

type Ctx = { params: { tab: string } };

export async function GET(_req: Request, { params }: Ctx) {
  if (!isTab(params.tab)) return NextResponse.json({ error: 'Unknown tab' }, { status: 400 });
  try {
    const db = await getDb();
    const rows = await db.collection('preferences').find({ tab: params.tab }).toArray();
    const pref: Record<string, number> = {};
    for (const r of rows) pref[String(r.id)] = r.number;
    return NextResponse.json(pref);
  } catch {
    return NextResponse.json({ error: 'Database not reachable' }, { status: 503 });
  }
}

// Replaces the whole list for one tab. Body: { pref: { "<option id>": number } }
export async function PUT(req: Request, { params }: Ctx) {
  const tab = params.tab;
  if (!isTab(tab)) return NextResponse.json({ error: 'Unknown tab' }, { status: 400 });
  let body: { pref?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const pref = body.pref || {};
  try {
    const db = await getDb();
    const opts = await db.collection('options').find({ tab }).project({ id: 1, short: 1 }).toArray();
    const byId = new Map(opts.map((o) => [String(o.id), o]));
    const used = new Map<number, string>();
    type PrefDoc = { _id: string; tab: string; id: number; option_id: string; number: number; short: string; updated_at: Date };
    const docs: PrefDoc[] = [];
    for (const [id, n] of Object.entries(pref)) {
      const o = byId.get(id);
      if (!o) return NextResponse.json({ error: `Unknown option ${id}` }, { status: 400 });
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1)
        return NextResponse.json({ error: `Preference for ${o.short} must be a whole number of 1 or more` }, { status: 400 });
      if (used.has(n)) return NextResponse.json({ error: `#${n} is used twice` }, { status: 409 });
      used.set(n, id);
      docs.push({ _id: `${tab}-${id}`, tab, id: Number(id), option_id: `${tab}-${id}`, number: n, short: o.short, updated_at: new Date() });
    }
    const client = await getClient();
    const col = db.collection<PrefDoc>('preferences');
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await col.deleteMany({ tab }, { session });
        if (docs.length) await col.insertMany(docs, { session });
      });
    } finally {
      await session.endSession();
    }
    return NextResponse.json({ ok: true, saved: docs.length });
  } catch {
    return NextResponse.json({ error: 'Could not save to the database' }, { status: 500 });
  }
}
