'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Option, Prefs, Tab } from '@/lib/types';

const TAB_INFO: Record<Tab, { label: string; sub: string; note: string }> = {
  dch: {
    label: 'DCH',
    sub: '2-year diploma',
    note: '86 options from the merged DCH list (incl. Zynerd). Stipend is monthly, year 1 / year 2.',
  },
  pd: {
    label: 'DNB Paediatrics',
    sub: '3-year degree',
    note: '92 options from the DNB Paediatrics list, incl. new 2026 hospitals in other states. Stipend is monthly, years 1 / 2 / 3. At her rank most are long shots.',
  },
};
const CHANCES = ['Good', 'Borderline', 'Possible', 'Stretch', 'Reserved only', 'No seat 2026'];
const LS = (t: Tab) => `choice-sheet-${t}`;

const chipCls = (c: string) => 'chip c-' + c.split(' ')[0];
const noBond = (o: Option) => /none/i.test(o.bond);
const fmtRank = (r: number | null) => (r ? r.toLocaleString('en-IN') : '—');

function readLocal(t: Tab): Prefs {
  try {
    const s = JSON.parse(localStorage.getItem(LS(t)) || 'null');
    return s && typeof s === 'object' ? s : {};
  } catch {
    return {};
  }
}
function writeLocal(t: Tab, p: Prefs) {
  try { localStorage.setItem(LS(t), JSON.stringify(p)); } catch { /* storage blocked */ }
}

export default function ChoiceSheet() {
  const [tab, setTab] = useState<Tab>('dch');
  const [view, setView] = useState<'options' | 'mine'>('options');
  const [options, setOptions] = useState<Record<Tab, Option[]>>({ dch: [], pd: [] });
  const [prefs, setPrefs] = useState<Record<Tab, Prefs>>({ dch: {}, pd: {} });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [fState, setFState] = useState('');
  const [fChance, setFChance] = useState('');
  const [fNoBond, setFNoBond] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState('');
  const [db, setDb] = useState('Loading from database…');
  const [online, setOnline] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const loaded = useRef(false);

  const flash = useCallback((t: string) => {
    setToast(t);
    clearTimeout(timers.current.toast);
    timers.current.toast = setTimeout(() => setToast(''), 2600);
  }, []);

  // Initial load: options + preferences from the API, falling back to this browser's copy.
  useEffect(() => {
    (async () => {
      try {
        const [d, p, pd, pp] = await Promise.all([
          fetch('/api/options?tab=dch').then((r) => (r.ok ? r.json() : Promise.reject())),
          fetch('/api/preferences/dch').then((r) => (r.ok ? r.json() : Promise.reject())),
          fetch('/api/options?tab=pd').then((r) => (r.ok ? r.json() : Promise.reject())),
          fetch('/api/preferences/pd').then((r) => (r.ok ? r.json() : Promise.reject())),
        ]);
        setOptions({ dch: d, pd });
        setPrefs({ dch: p, pd: pp });
        writeLocal('dch', p); writeLocal('pd', pp);
        setDb('Saved to database');
      } catch {
        setOnline(false);
        setPrefs({ dch: readLocal('dch'), pd: readLocal('pd') });
        setDb('Database offline: choices are kept in this browser only');
      } finally {
        loaded.current = true;
      }
    })();
  }, []);

  const save = useCallback((t: Tab, p: Prefs) => {
    writeLocal(t, p);
    if (!online) return;
    clearTimeout(timers.current[t]);
    setDb('Saving…');
    timers.current[t] = setTimeout(async () => {
      try {
        const r = await fetch(`/api/preferences/${t}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pref: p }),
        });
        const j = await r.json();
        setDb(r.ok ? `Saved to database · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Not saved: ${j.error || 'error'}`);
      } catch {
        setDb('Could not reach the database. Kept in this browser; it will save on your next change.');
      }
    }, 500);
  }, [online]);

  const opts = options[tab];
  const pref = prefs[tab];
  const byId = useMemo(() => new Map(opts.map((o) => [String(o.id), o])), [opts]);
  const order = useMemo(
    () => Object.keys(pref).filter((k) => byId.has(k)).sort((a, b) => pref[a] - pref[b]),
    [pref, byId],
  );
  const nextFree = useMemo(() => {
    const used = new Set(Object.values(pref));
    let n = 1;
    while (used.has(n)) n++;
    return n;
  }, [pref]);

  const update = (p: Prefs) => {
    setPrefs((all) => ({ ...all, [tab]: p }));
    save(tab, p);
  };

  const assign = (id: string, raw: string) => {
    const v = raw.trim();
    setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
    setErrs((e) => { const n = { ...e }; delete n[id]; return n; });
    const o = byId.get(id)!;
    if (v === '') {
      if (pref[id]) { const p = { ...pref }; delete p[id]; update(p); flash(`Removed ${o.short}`); }
      return;
    }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) { setErrs((e) => ({ ...e, [id]: 'Use a whole number, 1 or more.' })); return; }
    const owner = Object.keys(pref).find((k) => pref[k] === n && k !== id);
    if (owner) {
      setErrs((e) => ({ ...e, [id]: `#${n} is already given to ${byId.get(owner)?.short}. Next free: ${nextFree}.` }));
      return;
    }
    update({ ...pref, [id]: n });
    flash(`${o.short} set to #${n}`);
  };

  const addNext = (id: string) => { update({ ...pref, [id]: nextFree }); flash(`Added as #${nextFree}`); };
  const remove = (id: string) => { const p = { ...pref }; delete p[id]; update(p); flash('Removed'); };
  const swap = (id: string, dir: -1 | 1) => {
    const i = order.indexOf(id); const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const a = order[i], b = order[j];
    update({ ...pref, [a]: pref[b], [b]: pref[a] });
  };
  const suggested = () => {
    const p: Prefs = {};
    opts.filter((o) => o.chance !== 'Reserved only' && o.chance !== 'No seat 2026' && (o.open ?? 1) > 0)
      .forEach((o, i) => { p[String(o.id)] = i + 1; });
    update(p); setErrs({}); flash(`Suggested order loaded (${Object.keys(p).length})`);
  };
  const closeGaps = () => {
    const p: Prefs = {}; order.forEach((id, i) => { p[id] = i + 1; });
    update(p); flash(`Renumbered 1 to ${order.length}`);
  };
  const clearAll = () => { update({}); setConfirmClear(false); flash('All numbers cleared'); };

  const listText = order.map((id) => {
    const o = byId.get(id)!;
    return `${pref[id]}. ${o.short} (${o.course}, ${o.state}) – ${o.chance}; stipend ${o.stipend}; bond ${o.bond}`;
  }).join('\n');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(listText); flash(`Copied ${order.length} choices`); }
    catch { textRef.current?.focus(); textRef.current?.select(); flash('Text selected – copy it from the box'); }
  };

  const states = useMemo(() => [...new Set(opts.map((o) => o.state))].sort(), [opts]);
  const filtered = opts.filter((o) =>
    (!q || `${o.name} ${o.state}`.toLowerCase().includes(q.toLowerCase())) &&
    (!fState || o.state === fState) && (!fChance || o.chance === fChance) && (!fNoBond || noBond(o)));
  const activeFilters = [fState, fChance, fNoBond ? 'x' : ''].filter(Boolean).length;

  const switchTab = (t: Tab) => {
    setTab(t); setQ(''); setFState(''); setFChance(''); setFNoBond(false); setErrs({}); setDrafts({}); setConfirmClear(false);
  };

  const facts = (o: Option) => (
    <div className="facts">
      <span>{o.state}</span>
      <span>Open <b className="num">{o.open ?? '–'}/{o.total ?? '–'}</b></span>
      <span>2025 rank <b className="num">{fmtRank(o.rank)}</b></span>
      <span>Stipend <b>{o.stipend}</b></span>
      <span style={{ gridColumn: '1 / -1' }}>Bond <b>{o.bond}</b></span>
    </div>
  );

  const numberBox = (o: Option, side: string) => {
    const id = String(o.id);
    const val = drafts[id] ?? (pref[id] ? String(pref[id]) : '');
    return (
      <div className="slot">
        <label htmlFor={`n-${side}-${tab}-${id}`}>Preference</label>
        <input
          id={`n-${side}-${tab}-${id}`}
          className={`pn${pref[id] ? ' set' : ''}${errs[id] ? ' bad' : ''}`}
          type="number" inputMode="numeric" min={1} step={1} enterKeyHint="done"
          placeholder={String(nextFree)} value={val}
          aria-label={`Preference number for ${o.short}`}
          onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
          onBlur={(e) => { if (drafts[id] !== undefined) assign(id, e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
        />
        {errs[id] && <div className="err" role="alert">{errs[id]}</div>}
      </div>
    );
  };

  let lastGroup = '';
  let expect = 1;

  return (
    <>
      <div className="wrap">
        <header className="top">
          <div className="titlerow">
            <div>
              <div className="eyebrow">MCC NEET PG 2026 · DNB quota</div>
              <h1>DCH Choice Sheet</h1>
            </div>
            <div className="who">AIR <b>42,456</b> · General · Jamshedpur</div>
          </div>
          <div className="seg" role="tablist" aria-label="Course">
            {(['dch', 'pd'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => switchTab(t)}>
                {TAB_INFO[t].label} <span className="badge">{Object.keys(prefs[t]).length}</span>
                <small>{TAB_INFO[t].sub}</small>
              </button>
            ))}
          </div>
          {(
            <div className="searchrow">
              <input className="field" type="search" placeholder="Search hospital or city" aria-label="Search hospital or city"
                value={q} onChange={(e) => setQ(e.target.value)} id="search" />
              <button className="btn" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} aria-controls="filters">
                Filters{activeFilters ? <span className="badge">{activeFilters}</span> : null}
              </button>
            </div>
          )}
          <div className="filters" id="filters" hidden={!showFilters}>
            <select className="field" value={fState} onChange={(e) => setFState(e.target.value)} aria-label="State" id="f-state">
              <option value="">All states</option>
              {states.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="field" value={fChance} onChange={(e) => setFChance(e.target.value)} aria-label="Chance" id="f-chance">
              <option value="">Any chance</option>
              {CHANCES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <label className="check"><input type="checkbox" checked={fNoBond} onChange={(e) => setFNoBond(e.target.checked)} id="f-nobond" /> No bond only</label>
          </div>
        </header>

        <div className="cols">
          <section className="panel" aria-labelledby="h-all" hidden={view !== 'options'}>
            <div className="ph">
              <h2 id="h-all">All {TAB_INFO[tab].label} options</h2>
              <span className="sub">{filtered.length} of {opts.length}</span>
            </div>
            <div className="note-line">{TAB_INFO[tab].note} Type a number, or tap <b>Add</b> for the next free one. A number can be used only once.</div>
            {opts.length === 0 && <div className="empty">{online ? 'Loading options…' : 'Options need the database. Run the app with DATABASE_URL set.'}</div>}
            {opts.length > 0 && filtered.length === 0 && <div className="empty">No options match these filters.</div>}
            {filtered.map((o) => {
              const id = String(o.id);
              const head = o.group !== lastGroup ? (lastGroup = o.group, <div className="grp" key={'g' + o.group}>{o.group.replace(/^(DCH|DNB Paediatrics) · /, '')}</div>) : null;
              return (
                <div key={id}>
                  {head}
                  <div className={`opt${pref[id] ? ' in' : ''}`}>
                    <div style={{ minWidth: 0 }}>
                      <div className="name">{o.short} <span className={chipCls(o.chance)}>{o.chance}</span></div>
                      {facts(o)}
                      {o.note && <div className="note">{o.note}</div>}
                    </div>
                    <div className="slot">
                      {numberBox(o, 'a')}
                      {!pref[id] && <button className="quick" onClick={() => addNext(id)} aria-label={`Add ${o.short} as number ${nextFree}`}>Add #{nextFree}</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="panel mine-panel" aria-labelledby="h-mine" hidden={view !== 'mine'}>
            <div className="ph">
              <div>
                <h2 id="h-mine">My {TAB_INFO[tab].label} order</h2>
                <div className="sub">{order.length} numbered · next free #{nextFree}</div>
              </div>
              <div className="db" role="status">{db}</div>
            </div>
            <div className="toolbar">
              <button className="btn small" onClick={suggested}>Load suggested order</button>
              <button className="btn small" onClick={closeGaps} disabled={!order.length}>Close gaps</button>
              <button className="btn small primary" onClick={copy} disabled={!order.length}>Copy list</button>
              {confirmClear ? (
                <span className="confirm">Clear all numbers?
                  <button className="btn small danger" onClick={clearAll}>Yes, clear</button>
                  <button className="btn small" onClick={() => setConfirmClear(false)}>Cancel</button>
                </span>
              ) : (
                <button className="btn small danger" onClick={() => setConfirmClear(true)} disabled={!order.length}>Clear</button>
              )}
            </div>
            {!order.length && (
              <div className="empty">No choices numbered yet. Go to <b>Options</b> and tap <b>Add</b>, or type 1, 2, 3 … in the Preference box.</div>
            )}
            {order.map((id, i) => {
              const o = byId.get(id)!; const p = pref[id];
              const gap = p > expect ? <div className="gap" key={'gap' + id}>{p - expect > 1 ? `Numbers ${expect}–${p - 1}` : `Number ${expect}`} not used yet</div> : null;
              expect = p + 1;
              return (
                <div key={id}>
                  {gap}
                  <div className="pick">
                    {numberBox(o, 'm')}
                    <div style={{ minWidth: 0 }}>
                      <div className="name">{o.short} <span className={chipCls(o.chance)}>{o.chance}</span></div>
                      {facts(o)}
                    </div>
                    <div className="acts">
                      <button className="btn" onClick={() => swap(id, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                      <button className="btn" onClick={() => swap(id, 1)} disabled={i === order.length - 1} aria-label="Move down">↓</button>
                      <button className="btn danger" onClick={() => remove(id)} aria-label={`Remove ${o.short}`}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {order.length > 0 && (
              <div style={{ padding: '12px 14px' }}>
                <label className="eyebrow" htmlFor="listtext">Your list as text</label>
                <textarea id="listtext" ref={textRef} readOnly value={listText} />
              </div>
            )}
          </section>
        </div>

        <p className="foot">
          Chance uses 2025 MCC Round 2, Round 3 and Stray last Open ranks. Stipend is monthly; “~” means the state government rate.
          Bond from Meducate 2025-26 and state rules. Confirm bond and stipend in MCC Participating Institute Details before locking.
          MCC order is only your preference: a hard choice placed high never costs you an easier one lower down.
        </p>
      </div>

      <nav className="bar" aria-label="Views">
        <button aria-current={view === 'options' ? 'page' : undefined} onClick={() => { setView('options'); window.scrollTo({ top: 0 }); }}>
          Options <small>{opts.length} hospitals</small>
        </button>
        <button aria-current={view === 'mine' ? 'page' : undefined} onClick={() => { setView('mine'); window.scrollTo({ top: 0 }); }}>
          My order <small><span className="badge">{order.length}</span></small>
        </button>
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
