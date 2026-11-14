import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

// One saved Round 2 choice order: an ordered list of choice ids like "3-701429" (course group - MCC code).
const DOC_ID = 'salu';
const ID_RE = /^\d{1,2}-[A-Za-z0-9]{3,12}$/;
const MAX = 2000;

type OrderDoc = { _id: string; order: string[]; updated_at: Date };

export async function GET() {
  try {
    const db = await getDb();
    const doc = await db.collection<OrderDoc>('round2_order').findOne({ _id: DOC_ID });
    return NextResponse.json({ order: doc?.order ?? [], updated_at: doc?.updated_at ?? null });
  } catch {
    return NextResponse.json({ error: 'Database not reachable' }, { status: 503 });
  }
}

// Replaces the saved order. Body: { order: ["3-701429", "1-700417", ...] }
export async function PUT(req: Request) {
  let body: { order?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const order = body.order;
  if (!Array.isArray(order) || order.length > MAX)
    return NextResponse.json({ error: `order must be a list of at most ${MAX} choice ids` }, { status: 400 });
  const seen = new Set<string>();
  for (const id of order) {
    if (typeof id !== 'string' || !ID_RE.test(id)) return NextResponse.json({ error: `Bad choice id ${String(id).slice(0, 30)}` }, { status: 400 });
    if (seen.has(id)) return NextResponse.json({ error: `${id} is listed twice` }, { status: 409 });
    seen.add(id);
  }
  try {
    const db = await getDb();
    const updated_at = new Date();
    await db.collection<OrderDoc>('round2_order').updateOne(
      { _id: DOC_ID },
      { $set: { order: order as string[], updated_at } },
      { upsert: true },
    );
    return NextResponse.json({ ok: true, saved: order.length, updated_at });
  } catch {
    return NextResponse.json({ error: 'Could not save to the database' }, { status: 500 });
  }
}
