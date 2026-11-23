# Token Radar — pre-token protocol valuation board

[![make.fun bounty](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/rahmanhsim/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/rahmanhsim/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

An entry for make.fun's **[Build the best token launch radar](https://make.fun/bounty/token-radar-01)** bounty.

Token Radar ranks protocols that record no token yet by what a token would be worth if the
protocol's record stayed as it is, and gives a reader concrete steps to farm each one before or
after a token is issued.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22, standard library only: `main.ts` reads the sealed snapshot, writes `out/board.json`
(the ranked board, 200 rows), `out/data.js` (the dashboard's data) and `out/dashboard/`
(`index.html`, `app.css`, `app.js`), copies `dashboard/` and `screenshots/` to the output, and
writes `out/dossier.json` with `buildDossier` from `vendor/makefun-board.ts`.

## The value model (`lib/model.ts`)

Every figure comes from the snapshot's own fields — TVL, seven-day growth, the day DefiLlama began
tracking the protocol, and its category. No protocol name is hardcoded.

- **Base** — `tvl_usd`, the protocol's recorded value today.
- **Momentum** — seven-day TVL growth, clipped to a symmetric window, so a collapse is not rewarded
  and a parabolic week is not extrapolated.
- **Maturity** — a multiplier that rises with the days since `listed_at`, because a protocol that has
  survived with no token has had longer to earn one.
- **Category risk** — lending, perp and DEX categories carry a different discount than bridge-like or
  yield-aggregator shapes, whose tokens historically issue later or not at all.

Rank 1 is the highest implied value. The watchlist (the 40 protocols at or above the house floor that
record no token) is always covered; the remaining rows are the highest-scoring pre-token protocols
below the floor, so the board reads the whole universe rather than the floor alone.

## The dashboard

`dashboard/` is a self-contained page: a ranked board sortable by rank, TVL, growth, age or implied
value; a search box and a category filter; a watchlist-only toggle; and a detail panel for every
protocol that shows the model's arithmetic and that protocol's farm steps. No network access, no
frameworks — three plain files.
