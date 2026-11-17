// Airdrop Radar — the value model (radar-2).
//
// The board ranks pre-token protocols by an implied launch value fitted on the
// snapshot's own traded comparables, never on a hand-written list of names.
//
// The fit (see dashboard for the chart and the numbers):
//   log(market cap) = 8.0718 + 0.4524 * log(TVL)
//                     + 0.003 * growth_clamped + log(maturity)
//   growth_clamped = clamp(change_7d, -60, 120), per cent
//   maturity       = 0.8 + 0.2 * min(age_days, 1095) / 1095
//   age unknown    -> 990 days (the median age of the traded comparables)
//
// Fitted by ordinary least squares on 111 comparable traded protocols: the
// snapshot's 144 traded protocols minus 16 whose recorded market cap is 0 or
// negative (dead tokens carry no price signal) and minus 17 CEX / Canonical
// Bridge records, whose market cap does not track the TVL in this snapshot
// (an exchange token is not priced off its deposits; a bridge's TVL is
// escrowed assets). In-sample R2 is 0.14 and 5-fold out-of-sample R2 is 0.09:
// TVL size is the only loading that survives out of sample. The growth and
// age loadings in the unconstrained fit are -0.02 (se 0.03) and -0.26
// (se 0.33) — both indistinguishable from zero — so the model imposes the
// economically required signs as small bounded priors instead: +0.003 per
// point of 7-day growth and a maturity factor of 0.8..1.0. The house
// starter's formula (0.25 x TVL, growth weight 0.5, maturity 0.6..1.0)
// scores -0.08 out of sample on the same folds, so this model beats it
// while keeping the same honest inputs: TVL, 7-day growth, age.
//
// Every row's farm plan is derived from the same record (category, chains,
// TVL, age) and is netted to the dollar: gas per transaction by chain,
// opportunity cost of the locked capital at 5% a year, and a FARM / THIN /
// SKIP verdict from the net cost against the implied value.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  intercept: number;
  elasticity: number;
  growth_tilt: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  /** Annual opportunity cost applied to locked farm capital. */
  apr: number;
}

export const MODEL: ModelConstants = {
  intercept: 8.0718,
  elasticity: 0.4524,
  growth_tilt: 0.003,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.8,
  maturity_range: 0.2,
  maturity_days: 1095,
  unknown_age_days: 990,
  apr: 0.05,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The fit's headline numbers, as the dashboard reports them. */
export const FIT = {
  comps: 111,
  traded_total: 144,
  excluded_dead: 16,
  excluded_cex_bridge: 17,
  r2_in_sample: 0.14,
  r2_oos_5fold: 0.09,
  r2_oos_starter: -0.08,
};

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    intercept: number;
    elasticity: number;
    growth_pct: number;
    growth_tilt: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
  /** Netted farm economics, in whole dollars, and the verdict. */
  farm_economics: {
    capital_usd: number;
    gas_usd: number;
    opportunity_usd: number;
    net_usd: number;
    verdict: 'FARM' | 'THIN' | 'SKIP';
  };
}

/** The dashboard's compact view of one row (arrays keep data.js small). */
export type RadarRow = [
  rank: number,
  slug: string,
  name: string,
  category: string | null,
  chains: string,
  tvl_usd: number,
  change_7d: number | null,
  age_days: number | null,
  implied_value_usd: number,
];

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export type LiveRow = [
  slug: string,
  name: string,
  category: string | null,
  chains: string,
  tvl_usd: number,
  mcap_usd: number | null,
  change_7d: number | null,
];

/** Everything the dashboard needs: the board, the live set, the fit and the model. */
export interface RadarData {
  v: string;
  as_of: string;
  floor_usd: number;
  model: ModelConstants;
  fit: typeof FIT;
  /** [log TVL, log mcap] of the 111 fitted comparables, rounded to 3 decimals. */
  comps: [number, number][];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The three multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; growthPct: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const logValue = model.intercept + model.elasticity * Math.log(protocol.tvl_usd) + model.growth_tilt * growthPct + Math.log(maturityMult);
  const implied = Math.max(1, Math.round(Math.exp(logValue)));
  return { implied, growthPct, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, growthPct, maturityMult, age } = impliedValue(p, snapshot.as_of, model);
    return { p, implied, growthPct, maturityMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const steps = farmSteps(s.p, s.age);
    const econ = farmEconomics(s.p, s.age, s.implied);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: s.implied,
      model: {
        intercept: model.intercept,
        elasticity: model.elasticity,
        growth_pct: s.growthPct,
        growth_tilt: model.growth_tilt,
        maturity_multiplier: round4(s.maturityMult),
        age_days: s.age,
      },
      farm_steps: steps.map(stepText),
      farm_economics: econ,
    };
  });
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The second chain a protocol names, or null. */
function secondChainOf(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Gas for one transaction on a chain, in whole dollars (typical, not a quote). */
export function gasPerTx(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 8;
  if (c === 'solana' || c === 'sui' || c === 'aptos') return 1;
  if (c === 'tron') return 1;
  if (c === 'binance') return 1;
  if (['base', 'arbitrum', 'optimism', 'polygon', 'zksync era', 'linea', 'blast', 'scroll', 'unichain', 'ink', 'katana', 'corn', 'monad', 'arc', 'abstract', 'soneium', 'mode', 'fraxtal', 'zora', 'world chain'].includes(c)) return 1;
  if (c === 'avalanche' || c === 'fantom' || c === 'celo' || c === 'gnosis' || c === 'xdai') return 1;
  return 2;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('stak') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('farm')) return `Deposit $${capital} of USDC into ${name}'s farm on ${chain} and keep the position open.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second qualifying action on the same chain, different from the first. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const half = Math.max(10, Math.round(capital / 2));
  if (c.includes('dex') || c.includes('yield')) return `Swap $${half} through ${name} on ${chain} so the wallet shows trading activity as well as liquidity.`;
  if (c.includes('lend') || c.includes('cdp')) return `Borrow $${half} against the deposit on ${name} and repay it within the same week.`;
  if (c.includes('stak') || c.includes('restak')) return `Delegate a further $${half} through ${name} on ${chain} and keep both receipts.`;
  if (c.includes('bridge')) return `Bridge $${half} back through ${name} so the wallet shows two-way use.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the hedge on ${name} and open one new small position.`;
  return `Use $${half} in a second feature of ${name} on ${chain}, such as a swap or a vote.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names. The dashboard's page
 * regenerates these exact steps from the same inputs.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const name = p.name;
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasPerTx(chain);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const action = actionFor(p, capital, chain);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'no fee to set up',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
  ];
  if (second !== null) {
    const half = Math.max(10, Math.round(capital / 2));
    steps.push({
      text: `${name} also runs on ${second}: repeat the position there with $${half} so the wallet is active on both chains.`,
      cost: `$${half} of capital and about $${gasPerTx(second)} of gas`,
      time: '10 minutes',
    });
  } else {
    steps.push({
      text: secondActionFor(p, capital, chain),
      cost: `about $${gas} of gas`,
      time: '10 minutes',
    });
  }
  steps.push(
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about $${gas * weeks} of gas over ${weeks} weeks`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, then unwind in two steps so the exit is itself recorded.`,
      cost: `about $${gas * 2} of gas to exit`,
      time: '10 minutes',
    },
  );
  return steps;
}

/**
 * The plan netted to the dollar: gas for setup, weekly and exit transactions
 * on the protocol's chains, plus the opportunity cost of the locked capital
 * at 5% a year. The verdict is a rule of thumb, not a promise: FARM when
 * the implied value is large and the net cost is small, THIN when the
 * margin is narrow, SKIP otherwise.
 */
export function farmEconomics(p: SnapshotProtocol, age: number | null, implied: number): BoardRow['farm_economics'] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const txs = 1 + 1 + weeks + 2;
  let gas = txs * gasPerTx(chain);
  if (second !== null) gas += gasPerTx(second);
  const opportunity = Math.round(capital * MODEL.apr * (hold / 365) * 100) / 100;
  const net = Math.round((gas + opportunity) * 100) / 100;
  const verdict: 'FARM' | 'THIN' | 'SKIP' =
    implied >= 20_000_000 && net <= 40 ? 'FARM' : implied >= 8_000_000 && net <= 100 ? 'THIN' : 'SKIP';
  return { capital_usd: capital, gas_usd: gas, opportunity_usd: opportunity, net_usd: net, verdict };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => [
      p.slug,
      p.name,
      p.category,
      p.chains.slice(0, 3).join(', '),
      p.tvl_usd,
      p.mcap_usd,
      p.change_7d === null ? null : Math.round(p.change_7d * 100) / 100,
    ] as LiveRow);
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return [
    row.rank,
    row.slug,
    row.name,
    row.category,
    row.chains.slice(0, 3).join(', '),
    row.tvl_usd,
    row.change_7d === null ? null : Math.round(row.change_7d * 100) / 100,
    row.age_days,
    row.implied_value_usd,
  ];
}

/** The fitted comparables as [log TVL, log mcap] pairs, rounded to 3 decimals. */
export function compsPoints(snapshot: Snapshot): [number, number][] {
  const round3 = (n: number): number => Math.round(n * 1000) / 1000;
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.category !== 'CEX' && p.category !== 'Canonical Bridge')
    .map((p) => [round3(Math.log(p.tvl_usd)), round3(Math.log(p.mcap_usd!))] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    v: MODEL_VERSION,
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    model,
    fit: FIT,
    comps: compsPoints(snapshot),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
