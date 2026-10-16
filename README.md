# DCH & DNB Paediatrics Choice Sheet

A Next.js app for ordering NEET PG 2026 (MCC) choices for **DCH (NBEMS diploma)** and **DNB Paediatrics**, with preferences saved in **MongoDB**.

- Two course tabs: **DCH** (86 options) and **DNB Paediatrics** (92 options)
- Tap **Add** to give a hospital the next free number, or type any preference number; each number can be used only once
- Each option shows Open seats (MCC Final DNB Seat Matrix 2026), 2025 last Open rank, chance, monthly stipend and bond
- Search, filters (state, chance, no bond only), move up/down, close gaps, copy the list as text
- Mobile-first: on phones, a bottom bar switches between **Options** and **My order**

## Run locally

```bash
npm install
echo 'DATABASE_URL=mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/' > .env
npm run seed      # loads data/options.json into MongoDB (first time only)
npm run build && npm start   # or: npm run dev
```

Open http://localhost:3000.

## API

| Route | Method | What it does |
|---|---|---|
| `/api/options?tab=dch\|pd` | GET | All options for a tab |
| `/api/preferences/:tab` | GET | `{ "<option id>": number }` |
| `/api/preferences/:tab` | PUT | Body `{ "pref": { "<option id>": number } }`; replaces the list, rejects repeated numbers |

MongoDB database `salu_choice_filling`: collections `options` and `preferences` (unique indexes on tab+number and tab+option).

## Deploy

Works on Vercel: import the repo and set the `DATABASE_URL` environment variable. In MongoDB Atlas, allow access from the host (Network Access).

`legacy/index.html` is the original single-file version (saves in the browser only).

Data sources: MCC NEET PG 2025 allotment results (Rounds 1–3, Stray), MCC Final DNB Seat Matrix 2026, Meducate DNB stipend and bond tables. Always confirm bond and stipend in MCC Participating Institute Details before locking choices.
