# Splitr — Design Spec

**Date:** 2026-06-25
**Status:** Approved (design); pending implementation
**Owner:** Bibas (GitHub `Kandel-Bibas`)

## 1. Purpose

A single-operator, laptop-only web app that turns messy shared expenses into clean
per-person amounts that the operator copies into **Splitwise**. Splitwise remains the
source of truth for balances and settle-up. Splitr's only job is the math that is
annoying to do by hand:

- **Restaurant / outing splits** — one person pays, the bill is split among the
  specific people who participated.
- **Grocery splits (Walmart / Sam's Club)** — a receipt is split *per item*, because
  roommates don't all eat the same things. Tax is shared proportionally to what each
  person actually bought.

The app is used by **one operator** (no accounts, no auth). Roommates and friends exist
only as named "people" in the math.

## 2. Non-goals (explicitly out of scope for v1)

- No accounts / login / multi-user.
- No balance tracking, settle-up history, or "who owes whom over time" — that lives in
  Splitwise.
- No cloud, hosting, containers, or phone access. Runs on the operator's laptop only.
  (The stack is chosen so a future deploy is possible without a rewrite, but none is built.)
- No account scraping of Walmart/Sam's (no sanctioned API; brittle and a security risk).
- No traditional OCR fallback.
- No percentage/share splits beyond **even** and **exact amounts**.
- No multi-currency. USD only.
- No order-level discount/reward proration. The split covers `subtotal + tax = total`
  as printed; payment-method rewards (e.g. "WALMART REWARDS 5.87") do not change who
  consumed what and are ignored for splitting.

## 3. Users & primary flows

Single operator. Three things they do:

1. **Manage people** — a small roster: roommates (marked as defaults so they're
   pre-selected) plus occasional friends.
2. **Add an expense** — either *Itemized* (photo of a store receipt) or *Simple*
   (a typed total for an outing).
3. **Read the result and copy it into Splitwise** — per-person breakdown with a
   one-tap "copy for Splitwise" text, then mark the expense as logged.

## 4. The two expense types

### 4.A Itemized receipt (Walmart / Sam's)

1. Operator uploads or takes a photo of the receipt.
2. Backend resizes/normalizes the image (incl. iPhone **HEIC** → JPEG) and sends it to
   a **Gemini vision** model, requesting structured JSON (schema in §6).
3. App shows an **editable item table** pre-filled from Gemini: each row has
   `name`, `quantity`, `unit price`, `line total`. Operator can fix any misread, add,
   or delete rows. The app shows parsed `subtotal`, `tax`, `total` and **flags a
   mismatch** if `sum(line totals) ≠ subtotal` or `subtotal + tax ≠ total`, so a
   bad parse can't silently corrupt the split.
4. **Assign each item to the people who share it.** Items default to "everyone"
   (all default/roommate people). A **bulk mode** lets the operator select several rows
   and toggle a person for all of them at once (most groceries are shared; only a few
   differ). Each item is split **evenly among its assignees only**.
5. **Tax (and any fees) prorate by item price** — see §5. Operator picks the **payer**.
6. App shows the per-person breakdown and a copy-for-Splitwise summary; operator saves.

### 4.B Simple split (eating out)

A form: `description`, `total amount`, `payer`, and the **participants** (default
roommates pre-checked, add friends as needed). Split method:

- **Even** (default): total split equally among participants.
- **Exact**: operator types each participant's exact amount; the app validates that the
  amounts sum to the total before saving.

No items, no photo, no tax field (tax is already baked into the typed total).

## 5. Split math (the critical core)

All split math lives in one **pure TypeScript module** (`lib/split`) with no I/O, so it
is fully unit-testable. Money is handled in **integer cents** throughout to avoid float
drift; conversion to/from dollars happens only at the edges.

### 5.1 Itemized proration

Given items `i` with line total `Lᵢ` (cents) assigned to a non-empty person set `Aᵢ`,
subtotal `S = Σ Lᵢ`, and additional charges `T` (tax, in cents):

1. **Prorate tax across items by line share.** Each item's effective cost:
   `Cᵢ = Lᵢ + round(T · Lᵢ / S)`.
   Distribute any rounding residual (`T − Σ round(T·Lᵢ/S)`) by the **largest-remainder
   method** so `Σ Cᵢ = S + T = total` exactly.
2. **Each person's exact fractional share is `Oₚ* = Σᵢ (Cᵢ / |Aᵢ|)`** over the items
   `i` they're assigned to. These exact (rational) shares sum to `total` exactly.
3. **Reconcile to whole cents once, at the person level.** Floor each `Oₚ*`, then hand
   the leftover cents (`total − Σ floor(Oₚ*)`) to the people with the largest fractional
   remainders (deterministic tie-break by sorted `personId`). To keep this exact and
   float-free, shares are accumulated as integers scaled by `D = lcm(|Aᵢ|)`; the floor
   and remainder are computed by integer division/modulo by `D`.

   This **global** reconciliation (vs. rounding each item independently) avoids a
   systematic bias where the first-listed assignee accrues every item's leftover cent —
   e.g. two people sharing an entire $80.79 receipt split **$40.40 / $40.39**, not
   $40.44 / $40.35. `Σ Oₚ = total` is guaranteed.

### 5.2 Simple split

- **Even:** apportion `total` across participants by largest-remainder (each gets
  `floor(total/n)`, remaining cents go to the participants with the largest remainders,
  deterministic tie-break by participant order).
- **Exact:** use the entered amounts as-is after validating `Σ = total`.

### 5.3 Penny reconciliation (largest-remainder / Hamilton)

Whenever an amount is divided, shares are floored to cents and the leftover cents are
handed out **one each** to the recipients with the largest fractional remainders, ties
broken by a stable order (person/item index). This guarantees the rounded parts always
sum **exactly** to the amount divided — no missing or phantom penny.

### 5.4 Output shape

For an expense with payer `P` and per-person totals `Oₚ`:

- Every non-payer `p` **owes `Oₚ` to `P`**.
- The payer's own `O_P` is just their personal consumption (owed to no one).
- This maps directly onto a Splitwise entry: "`P` paid `total`, split unequally:
  each `p` owes `Oₚ`."

## 6. Gemini receipt parsing

- **Endpoint:** `POST /api/expenses/parse-receipt` (multipart image upload). Stateless —
  returns parsed JSON; nothing is persisted until the operator saves the expense.
- **Pre-processing:** decode HEIC/JPEG/PNG, auto-orient, downscale to a max dimension
  (~1600px) and re-encode JPEG to control token cost and latency.
- **Model:** a current Gemini multimodal model. Exact model id (e.g. `gemini-2.5-flash`
  vs `-pro`) is **pinned at implementation time after checking current availability**
  via context7/Google docs; default to a `flash` tier for cost, allow override via env.
- **Auth:** `GEMINI_API_KEY` from Google AI Studio (billed to the operator's Google
  Cloud account), read from a local `.env`. App fails with a clear setup error if absent.
- **Structured output:** request `responseSchema` (or equivalent) so Gemini returns:

  ```jsonc
  {
    "store": "Walmart" | "Sam's Club" | string | null,
    "purchasedAt": "YYYY-MM-DD" | null,
    "items": [
      {
        "rawName": "GVGRK LT VA",        // text as printed
        "name": "Great Value Greek Light Vanilla Yogurt", // expanded, human-readable
        "quantity": 1,                    // resolves "2 AT 1 FOR 0.97" and weight lines
        "unitPrice": 3.28,                // dollars
        "lineTotal": 3.28                 // dollars
      }
    ],
    "subtotal": 55.26,
    "tax": 2.76,
    "total": 58.02,
    "warnings": ["string", ...]           // parser's own notes about uncertainty
  }
  ```

- **Validation after parse:** convert to cents; check `Σ lineTotal ≈ subtotal` and
  `subtotal + tax ≈ total` (tolerance ±a few cents). Surface mismatches as editable
  warnings in the item table; never auto-trust a bad parse.
- **Error handling:** timeouts, non-receipt images, malformed JSON, and missing API key
  all return a clear error and drop the operator into an **empty editable table**
  (manual entry as the always-available backstop).

## 7. Data model (Prisma + SQLite)

Single local SQLite file (`prisma/dev.db`). Money stored as **integer cents**.

- **Person** `{ id, name, colorHex, isDefault (roommate), archived, createdAt }`
- **Expense** `{ id, type: ITEMIZED|SIMPLE, description, store?, purchasedAt?,
  payerId → Person, subtotalCents, taxCents, totalCents, splitMethod: EVEN|EXACT|ITEMIZED,
  loggedToSplitwise: bool, imagePath?, createdAt }`
- **Item** `{ id, expenseId → Expense, rawName?, name, quantity, unitPriceCents,
  lineTotalCents, sortOrder }` (itemized only)
- **ItemAssignment** `{ itemId → Item, personId → Person }` (many-to-many; who shares an item)
- **ExpenseParticipant** `{ expenseId → Expense, personId → Person, exactAmountCents? }`
  (simple split only; `exactAmountCents` set when `splitMethod = EXACT`)

The stored breakdown is **derived** by the pure split lib from the persisted
items/assignments/participants, so it can always be recomputed and is never the only
copy of truth.

## 8. API surface (Next.js route handlers)

- `GET/POST /api/people`, `PATCH/DELETE /api/people/[id]`
- `GET/POST /api/expenses`, `GET/PATCH/DELETE /api/expenses/[id]`
- `POST /api/expenses/parse-receipt` — image → Gemini → parsed JSON (no persistence)
- `PATCH /api/expenses/[id]` also handles `loggedToSplitwise` toggle

Split computation runs through the shared `lib/split` module (same code in API and UI),
so what the operator previews is exactly what's stored.

## 9. UI screens

Responsive, mobile-friendly layout (even though laptop-only) so it's pleasant in a
narrow browser window. Tailwind. Follows the operator's frontend design bans (no
left-edge accent bars, no uppercase wide-tracking labels, no colored-dot status pills,
no ambient radial glows) — plain borders/contrast, normal-case labels by weight/size.

1. **People** — list with add/edit/archive; toggle "roommate (default)"; assign a color
   for quick visual identification in assignment UI.
2. **Home / history** — list of expenses (date, store/description, total, payer, a
   compact per-person glance, and a "logged" badge). "New expense" entry point.
3. **New itemized** — upload/take photo → parsing state → editable item table with
   per-item person toggles + bulk-assign mode → payer select → live breakdown → save.
4. **New simple** — form (description, amount, payer, participants, even/exact) → live
   breakdown → save.
5. **Expense detail** — full breakdown, **copy-for-Splitwise** button, mark-logged
   toggle, edit, delete.

## 10. Error handling & edge cases

- Gemini failure / missing key → clear message + manual empty table.
- Image format (HEIC/large) → normalized server-side before the model call.
- `sum(items) ≠ subtotal` or `subtotal + tax ≠ total` → visible warning, editable.
- Item assigned to **nobody** → block save with a clear prompt (can't split to no one).
- Exact split where amounts don't sum to total → validation error, can't save.
- Single participant / single assignee → that person owes the whole item; math still holds.
- Zero tax → proration is a no-op; still reconciles.

## 11. Tech stack

- **Next.js (App Router) + React + TypeScript** — one app, UI + API routes.
- **Tailwind CSS** for styling.
- **Prisma + SQLite** — single local DB file.
- **Gemini API** (`@google/genai` or current SDK; pinned at implementation) for parsing.
- **sharp** (+ HEIC support) for image normalization.
- **Vitest** for unit tests (split lib is the priority target).
- Started locally with one command (`npm run dev`); used at `http://localhost:3000`.

## 12. Testing strategy

The **split math is tested hardest** because the operator must trust the numbers:

- **Unit tests (Vitest)** for `lib/split`, in integer cents:
  - Tax proration sums exactly to `subtotal + tax`.
  - Per-item even split among assignees; penny reconciliation never loses/gains a cent.
  - Simple even and exact splits; exact-sum validation.
  - Edge cases: single person, all-assignees, zero tax, odd totals that force rounding.
  - **Fixtures from the two real receipts** (Walmart $58.02, Sam's $80.79) with at least
    two assignment scenarios each, asserting exact per-person totals that re-sum to the
    receipt total.
- **Lighter integration checks** on the parse→validate path with a canned Gemini response
  (no live API call in tests) to confirm cents conversion and mismatch flagging.
- Live Gemini parsing is verified manually against the two sample receipts during
  implementation.

## 13. Done criteria

1. `npm run dev` starts the app on localhost; people can be created/edited.
2. A Walmart/Sam's photo parses into an editable item table via Gemini; mismatches flag.
3. Items can be assigned (incl. bulk), tax prorates, and the per-person breakdown
   re-sums exactly to the receipt total.
4. A simple even/exact split produces a correct breakdown.
5. Copy-for-Splitwise yields a clean, pasteable per-person summary; expenses persist and
   can be marked logged.
6. `npm test` passes, including the two-receipt fixtures and penny-reconciliation cases.
