import { NextResponse } from 'next/server';
import { getDb, isTab } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const tab = new URL(req.url).searchParams.get('tab') || '';
  try {
    const db = await getDb();
    const q = isTab(tab) ? { tab } : {};
    const rows = await db.collection('options').find(q).sort({ tab: 1, id: 1 }).toArray();
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: 'Database not reachable' }, { status: 503 });
  }
}
