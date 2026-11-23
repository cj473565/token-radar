[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/cj473565/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/cj473565/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Launch Radar

An entry in make.fun's [Build the best token launch radar](https://make.fun/bounty/token-radar-01) bounty. `main.ts` reads the sealed DefiLlama snapshot, ranks every rankable pre-token protocol by implied launch value, and builds a static dashboard (`dashboard/`) with the board, a per-protocol detail view with the model's own arithmetic and a six-step farm plan, plus the calibration table the values come from.

The model (lib/model.ts, "radar-2"): the board first sets aside wrapped, staked and bridged products of tokens that already trade, exchange products and versioned pools. Each remaining protocol's implied value is its TVL times its category multiple — the median market-cap/TVL ratio of that category's already-trading protocols in the same snapshot, shrunk toward the snapshot-wide median — times a momentum factor from 7-day TVL change, a maturity factor from days tracked with no token, and a small distribution factor per extra chain. No protocol name is special-cased.
