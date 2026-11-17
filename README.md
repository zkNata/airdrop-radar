# Airdrop Radar

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/zkNata/airdrop-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard)
[![reward](https://make.fun/badge/token-radar-01/zkNata/airdrop-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01): 200 pre-token protocols from a frozen DefiLlama snapshot, ranked by implied launch value, each with a farm plan netted to the dollar.

## What it does

`main.ts` (Node 22, standard library only, no network) reads the sealed snapshot at `/input/snapshot.json`, scores every pre-token protocol with a model fitted on the tokens that already trade, and writes:

- `board.json` — 200 ranked rows (the 40 watchlist protocols at or above $50M TVL, plus 160 early ones below the floor), each with an implied value and a seven-step farm plan.
- `data.js` — the same board as a compact dataset for the dashboard.
- `dashboard/` — a static page: sortable, filterable board, per-protocol detail with the model's own inputs, and the fitted size curve.
- `dossier.json` — the summary the judge reads, built with the vendored `vendor/makefun-board.ts`.

## The model (radar-2)

`log(market cap) = 8.0718 + 0.4524 · log(TVL) + 0.003 · growth + log(maturity)`

Fitted on 111 traded comparables (16 dead tokens and 17 CEX/bridge records left out). Growth is the 7-day TVL change clamped to −60…+120%; maturity is 0.8 + 0.2 · min(age, 1095) / 1095. In-sample R² 0.14; 5-fold out-of-sample R² 0.09, against −0.08 for the house starter's formula on the same folds. TVL size is the only loading that survives out of sample, so growth and age enter as small bounded priors, and no protocol name is special-cased.

A farm plan costs capital by TVL tier ($50–$250), gas by chain, and opportunity cost at 5% a year over the hold. Verdict: **FARM** when implied value is at least $20M and net cost at most $40; **THIN** at $8M and $100; otherwise **SKIP**.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Run it twice and the outputs are byte-identical. Then open `out/dashboard/index.html` — it reads `out/data.js` beside it.

## What it is not

Implied value is this entry's own model claim, never make.fun's, and never a prediction that a token will launch. Gas figures are typical, not quotes, and the farm plan never asks you to pay to claim.

## License

MIT — see [LICENSE](LICENSE).
