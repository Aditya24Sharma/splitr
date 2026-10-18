#!/usr/bin/env bash
# Writes every row of the local SQLite database as SQL INSERTs that
# `wrangler d1 execute --file` can load into D1. Parents come before children
# so foreign keys hold. The output contains Plaid access tokens, so it must be
# written outside the repo and deleted after loading.
#
#   scripts/export-for-d1.sh prisma/dev.db /tmp/splitr-data.sql
set -euo pipefail
src=${1:?source .db file}
out=${2:?output .sql file}
case "$(cd "$(dirname "$out")" && pwd)" in
  "$(pwd)"*) echo "Refusing to write inside the repo: $out" >&2; exit 1 ;;
esac

tables=(Person Tag PlaidItem Account Transaction BalanceSnapshot Expense Item ItemAssignment ExpenseParticipant _ExpenseToTag)
: > "$out"
for t in "${tables[@]}"; do
  # insert mode with headers names every column, so column order can't matter
  sqlite3 -cmd ".mode insert \"$t\"" -cmd ".headers on" "$src" "SELECT * FROM \"$t\";" >> "$out"
done
echo "Wrote $(grep -c '^INSERT' "$out") rows to $out"
