# Splitr

A laptop-only personal tool for splitting restaurant bills and per-item store receipts (Walmart, Sam's Club, etc.) into clean per-person amounts you copy into Splitwise. No accounts, no server — single operator, local SQLite database.

---

## Setup

**Requirements:** [Node.js](https://nodejs.org) 22 or 24 LTS (anything ≥ 20.19 works). Check with `node -v`.

### 0. Get the code

Unzip `splitr.zip` (or `git clone` the repo) and open a terminal in the `splitr` folder.

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

```bash
npm run db:push
```

Creates `prisma/dev.db` (SQLite). `DATABASE_URL` defaults to `file:./prisma/dev.db` — no `.env` is needed for the database unless you want to override the path.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage — the Splitwise workflow

**Step 1 — Add people** (`/people`)  
Add your roommates and regular friends. Check "default" for roommates so they're pre-selected on every new expense.

**Step 2 — Create an expense**

- **Itemized** (`/expenses/new/itemized`): type in the receipt items → assign who shares each item → bulk-assign the common ones → pick who paid.  
- **Simple** (`/expenses/new/simple`): type a total and description → split evenly or enter exact per-person amounts.

**Step 3 — Copy and paste into Splitwise**  
Open the expense detail page, read the per-person breakdown, click **Copy for Splitwise**, paste into a new Splitwise expense, then check **Mark as logged**.

---

## How the math works

- All amounts are tracked in **integer cents** — no floating-point rounding.
- For itemized receipts, tax is **prorated across items by price** so the person who buys more expensive items absorbs proportionally more tax.
- Per-person totals are reconciled with a **largest-remainder algorithm** so they sum exactly to the receipt total with no first-person penny bias.

---

## Tests

```bash
npm test
```

Runs the Vitest unit suite (split engine, money utilities, validation, breakdown logic). Currently 28 tests across 5 files.

---

## Tech stack

Next.js 16 · TypeScript · Tailwind CSS v4 · Prisma 7 + SQLite (better-sqlite3 driver adapter) · Vitest
