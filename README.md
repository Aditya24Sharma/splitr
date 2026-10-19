# Splitr

Personal money tracker and bill splitter. Linked banks (through Plaid) and
hand-added expenses land in **Money**; any charge can be split with friends,
and your share comes off what you spent. Splits give clean per-person amounts
to copy into Splitwise.

Runs on Cloudflare Workers with a D1 (SQLite) database, behind Cloudflare
Access so only you can open it. Single user, no accounts.

---

## Develop locally

Requires Node.js 22+.

```bash
npm install
cp .env.example .env.local    # add your Plaid keys
npm run db:migrate:local      # create the tables in a local D1 copy (.wrangler/)
npm run dev                   # http://localhost:3000
```

`next dev` gets the same `DB` binding as production from a local D1 database,
via `initOpenNextCloudflareForDev()` in `next.config.ts`.

To run the real Workers build locally (the same runtime as production), put
the same keys in `.dev.vars` and run:

```bash
npm run preview               # http://localhost:8787
```

### Changing the database

D1 has no `prisma db push`. Edit `prisma/schema.prisma`, then write a migration:

```bash
npx prisma migrate diff --from-local-d1 --to-schema prisma/schema.prisma --script \
  > prisma/migrations/000N_what_changed.sql
npm run db:migrate:local
npx wrangler d1 migrations apply splitr --remote   # when deploying
```

D1 has no transactions: Prisma's `$transaction` runs its steps one by one.
Writes that must be all-or-nothing use a D1 batch (`lib/expense-write.ts`).

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

Next.js 16 · TypeScript · Tailwind CSS v4 · Prisma 7 + Cloudflare D1 ·
OpenNext for Cloudflare · Plaid (called with fetch) · Vitest
