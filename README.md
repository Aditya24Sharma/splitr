# Splitr

Personal money tracker and bill splitter. Linked banks (through Plaid) and
hand-added expenses land in **Money**; any charge can be split with friends,
and your share comes off what you spent. Splits give clean per-person amounts
to copy into Splitwise.

Runs on Cloudflare Workers with a D1 (SQLite) database, behind Cloudflare
Access so only you can open it. Single user, no accounts.

---

## How it's built

- **`src/`** — the React app (Vite + TanStack Router). It builds to static
  files that Cloudflare serves directly, without running any code.
- **`worker/`** — the API (Hono), the only code that runs on Cloudflare.
  Every route is under `/api`; `wrangler.jsonc` sends only those to the Worker.
- **`worker/db/schema.ts`** — the D1 tables, described for Drizzle.
- **`lib/`** — shared logic with no framework in it: the split math, money,
  spending summaries, input validation. Covered by `npm test`.

---

## Develop locally

Requires Node.js 22+.

```bash
npm install
cp .env.example .dev.vars     # add your Plaid keys
npm run db:migrate:local      # create the tables in a local D1 copy (.wrangler/)
npm run dev                   # http://localhost:5173
```

`npm run dev` runs the React app and the API together, with the API inside
Cloudflare's runtime and a local D1 database. To try the production build
locally, run `npm run preview`.

### Changing the database

Write the change as SQL, then describe it in `worker/db/schema.ts`:

```bash
npx wrangler d1 migrations create splitr what_changed   # new file in migrations/
npm run db:migrate:local
npx wrangler d1 migrations apply splitr --remote        # when deploying
```

D1 has no transactions. Writes that must be all-or-nothing go in one
`db.batch([...])`, which D1 runs as a single unit (see `worker/routes/expenses.ts`
and `worker/sync.ts`).

---

## Deploy

```bash
npm run deploy
```

Secrets are set once with `npx wrangler secret put <NAME>` for each key in
`.env.example`.

The app is served only at `money.aditya24sharma.dev`; `workers_dev` and preview
URLs are off in `wrangler.jsonc`, because they would skip the Access login.

---

## Usage

- **Money**: spending by month, where it went, and every transaction. **Sync**
  pulls new charges; **+ Add expense** logs cash. Tap **Split** on a charge to
  split it.
- **Splits**: every split; tick several to see who owes whom overall.
- **People**: who you split with. Mark yourself with **This is me** so splits
  from your charges start with you as the payer.
- **Banks**: link, sync, or unlink banks.

Spending leaves out money moving between your own accounts (transfers and
credit card payments), so a purchase isn't counted twice.

## How the math works

- All amounts are integer cents.
- Receipt tax is prorated across items by price.
- Per-person totals use a largest-remainder method so they add up to the total
  exactly.

## Tests

```bash
npm test
```

## Tech stack

React 19 · Vite · TanStack Router · Tailwind CSS v4 · Hono · Drizzle ORM +
Cloudflare D1 · Plaid (called with fetch) · Vitest
