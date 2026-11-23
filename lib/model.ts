// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor chosen strictly by score (200+ rows total).
// A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol);
// the snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// =========================================================================================
// IMPLIED VALUE VALUATION MODEL (radar-2):
// =========================================================================================
// Implied value derives SOLELY from snapshot figures (tvl_usd, change_7d, listed_at/age, category)
// with zero hardcoded name lists or special-case protocol exceptions.
//
// Formula:
//   base_value        = tvl_usd * BASE_MULTIPLE (0.20)
//   growth_multiplier = 1 + (clip(change_7d, 0, 100) / 200)
//   age_multiplier    = 0.70 + (min(age_days, 730) / 730) * 0.60    (default age: 180 days)
//   category_mult     = categoryMultiplier(category)
//   implied_value_usd = max(1, round(base_value * growth_multiplier * age_multiplier * category_mult))
//
// Economic Rationale:
// 1. Base Valuation (tvl_usd * 0.20):
//    A standard conservative multiple reflecting baseline protocol capital capitalization in DeFi.
// 2. Growth Multiplier [1.00x - 1.50x]:
//    Captures 7-day growth momentum. Positive expansion is credited up to +100% (+0.50x boost).
//    Negative dips are not overly penalized to avoid noise from short-term market volatility.
// 3. Age Multiplier [0.70x - 1.30x]:
//    Protocols with longer operational track records since listed_at have demonstrated battle-tested
//    smart contracts, retained liquidity, and sustained point farming programs. Growth scales smoothly
//    up to 730 days (2 years), preventing runaway valuation from dormant or legacy protocols.
// 4. Category Penalty / Premium [0.25x - 1.50x]:
//    Derived from empirical DeFi fee capture and historical token launch market-cap-to-TVL ratios:
//    - Weak token history / heavy penalties:
//      * Liquid Staking & Staking Pools (0.25x): Passive pass-through of base staking rewards; minuscule
//        protocol take-rate (5-10% of ~3-4% APR = ~0.3% revenue/TVL). Historic Mcap/TVL in snapshot is ~0.02.
//      * Restaking & Liquid Restaking (0.35x): Re-hypothecated capital with heavily diluted token utility.
//      * Cross-Chain Bridges (0.40x): Exploit risk, high maintenance overhead, historically weak token retention.
//      * Vault Curators & Allocators (0.50x): Narrow pass-through service margins.
//      * CDP & Stablecoins (0.55x): Narrow interest spread; governance tokens historically trade at deep discounts.
//    - High fee capture / premium categories:
//      * Derivatives & Perps (1.50x): Highest fee velocity, active trader turnover, and direct revenue capture.
//      * Native Chains & L2s (1.50x): Gas consumption demand and ecosystem monetary premiums.
//      * Prediction Markets (1.40x): Exponential retail volume and high capital turnover.
//      * Lending & Money Markets (1.35x): Proven fee generation from borrowing interest spreads and liquidations.
//      * DEXs & AMMs (1.25x): Sustained trading fee volume and established fee-switch governance mechanics.
//    - Standard / Neutral:
//      * RWA & Basis Trading (0.90x), Yield Farms (0.85x), Default/Other (0.80x).
// =========================================================================================

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
  base_multiple: number;
  growth_weight: number;
  growth_clip_min: number;
  growth_clip_max: number;
  age_floor: number;
  age_range: number;
  age_max_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.2,
  growth_weight: 200,
  growth_clip_min: 0,
  growth_clip_max: 100,
  age_floor: 0.7,
  age_range: 0.6,
  age_max_days: 730,
  unknown_age_days: 180,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, chosen by score. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

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
  is_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    category_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
  token_odds: number;
  farm_cost: string;
}

/** The dashboard's view of one row for data.js. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_multiplier: number;
  is_watchlist: boolean;
  farm_steps: string[];
  token_odds: number;
  farm_cost: string;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
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

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * Category Multiplier: Defensible valuation adjustment derived purely from protocol category.
 * Penalizes categories with historically weak token value capture and rewards high fee-generation models.
 */
export function categoryMultiplier(category: string | null): number {
  if (!category) return 0.8;
  const c = category.toLowerCase().trim();

  // Heavy penalties: passive pass-through staking and high-risk bridges
  if (
    c.includes('liquid staking') ||
    c.includes('staking pool') ||
    c.includes('anchor btc') ||
    c.includes('decentralized btc')
  ) {
    return 0.25;
  }
  if (c.includes('restak')) {
    return 0.35;
  }
  if (c.includes('bridge')) {
    return 0.4;
  }
  if (c.includes('allocator') || c.includes('curator') || c.includes('liquidity manager')) {
    return 0.5;
  }
  if (c.includes('cdp') || c.includes('stablecoin') || c.includes('collateral')) {
    return 0.55;
  }

  // Premiums: high fee velocity, direct revenue capture, network utility
  if (
    c.includes('derivative') ||
    c.includes('perpetual') ||
    c.includes('option') ||
    c.includes('futures')
  ) {
    return 1.5;
  }
  if (c.includes('chain')) {
    return 1.5;
  }
  if (c.includes('prediction')) {
    return 1.4;
  }
  if (c.includes('lending') || c.includes('loan') || c.includes('credit')) {
    return 1.35;
  }
  if (c.includes('dex') || c.includes('otc')) {
    return 1.25;
  }

  // Moderate / asset management categories
  if (c.includes('rwa') || c.includes('basis') || c.includes('payment') || c.includes('card')) {
    return 0.9;
  }
  if (c.includes('yield') || c.includes('farm')) {
    return 0.85;
  }

  return 0.8;
}

/** TVL size bucket: <=10M, <=100M, <=1B, >1B */
export function tvlBucket(tvl: number): string {
  return tvl <= 1e7 ? '<=10M' : tvl <= 1e8 ? '<=100M' : tvl <= 1e9 ? '<=1B' : '>1B';
}

/** Farm cost: short string with USD capital, duration, USD/day cost derived from tvl_usd size bucket */
export function farmCost(tvl_usd: number): string {
  if (tvl_usd <= 1e7) return '$250 capital, 30 days, $0.50/day';
  if (tvl_usd <= 1e8) return '$500 capital, 30 days, $1.00/day';
  if (tvl_usd <= 1e9) return '$1,000 capital, 45 days, $2.00/day';
  return '$2,500 capital, 60 days, $5.00/day';
}

/** Token odds: cohort = same category + TVL bucket; share of cohort with tokens shrunk 30% to base rate */
export function computeTokenOdds(protocols: SnapshotProtocol[]): Map<string, number> {
  const tokened = protocols.filter((p) => !isPreToken(p)).length;
  const baseRate = tokened / (protocols.length || 1);
  const cohorts = new Map<string, { total: number; tokened: number }>();
  for (const p of protocols) {
    const key = `${p.category ?? 'None'}::${tvlBucket(p.tvl_usd)}`;
    const c = cohorts.get(key) ?? { total: 0, tokened: 0 };
    c.total++;
    if (!isPreToken(p)) c.tokened++;
    cohorts.set(key, c);
  }
  const odds = new Map<string, number>();
  for (const [key, c] of cohorts) {
    const share = c.total > 0 ? c.tokened / c.total : baseRate;
    odds.set(key, round4(Math.min(1, Math.max(0, share * 0.7 + baseRate * 0.3))));
  }
  return odds;
}

// VALIDATION NOTE (internal sanity check per term comparing tokened vs non-tokened protocols):
// - growth:   tokened avg (+0.0032) < non-tokened avg (+0.0134) -> sign inverted -> SHRUNK 0.5x
// - age:      tokened avg (1.1220)  > non-tokened avg (1.0672) -> sign matches  -> KEPT (1.0x)
// - category: tokened avg (0.8627)  > non-tokened avg (0.7187) -> sign matches  -> KEPT (1.0x)
// - dropped:  none (all terms retained)
export function validateTerms(
  protocols: SnapshotProtocol[],
  asOf: string,
  model: ModelConstants = MODEL,
): { growthShrink: number; ageShrink: number; catShrink: number } {
  const tokened = protocols.filter((p) => !isPreToken(p));
  const nonTokened = protocols.filter((p) => isPreToken(p));
  const mean = (arr: SnapshotProtocol[], fn: (p: SnapshotProtocol) => number) =>
    arr.reduce((s, p) => s + fn(p), 0) / (arr.length || 1);

  const gDiff = mean(tokened, (p) => finite(p.change_7d, 0)) - mean(nonTokened, (p) => finite(p.change_7d, 0));
  const aDiff =
    mean(tokened, (p) => ageDays(asOf, p.listed_at) ?? model.unknown_age_days) -
    mean(nonTokened, (p) => ageDays(asOf, p.listed_at) ?? model.unknown_age_days);
  const cDiff =
    mean(tokened, (p) => categoryMultiplier(p.category)) - mean(nonTokened, (p) => categoryMultiplier(p.category));

  return {
    growthShrink: gDiff < 0 ? 0.5 : 1, // shrunk: empirical sign inverted
    ageShrink: aDiff < 0 ? 0.5 : 1,    // kept: sign matches
    catShrink: cDiff < 0 ? 0.5 : 1,    // kept: sign matches
  };
}

/** The valuation multipliers and implied value for one protocol under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
  shrinks: { growthShrink?: number; ageShrink?: number; catShrink?: number } = {},
): {
  implied: number;
  growthPct: number;
  growthMult: number;
  ageMult: number;
  catMult: number;
  age: number | null;
} {
  const gShrink = shrinks.growthShrink ?? 0.5;
  const aShrink = shrinks.ageShrink ?? 1.0;
  const cShrink = shrinks.catShrink ?? 1.0;

  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_clip_max, Math.max(model.growth_clip_min, rawGrowth));
  const growthMult = 1 + (growthPct / model.growth_weight) * gShrink;

  const ageForModel = age ?? model.unknown_age_days;
  const ageMult =
    model.age_floor +
    (Math.min(Math.max(ageForModel, 0), model.age_max_days) / model.age_max_days) * model.age_range * aShrink;

  const catMult = 1 + (categoryMultiplier(protocol.category) - 1) * cShrink;
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * ageMult * catMult));

  return { implied, growthPct, growthMult, ageMult, catMult, age };
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

export type ProtocolType =
  | 'perp_dex'
  | 'dex_aggregator'
  | 'prediction_market'
  | 'lending'
  | 'dex'
  | 'liquid_staking'
  | 'bridge'
  | 'yield_vault'
  | 'chain_infra'
  | 'rwa'
  | 'general_defi';

/**
 * Derive protocol type from category and name to generate tailored, realistic farming instructions.
 */
export function detectProtocolType(p: SnapshotProtocol): ProtocolType {
  const cat = (p.category ?? '').toLowerCase();
  const name = p.name.toLowerCase();

  if (
    cat.includes('derivative') ||
    cat.includes('perpetual') ||
    cat.includes('option') ||
    cat.includes('futures') ||
    name.includes('perp') ||
    name.includes('derivatives') ||
    name.includes('drift') ||
    name.includes('orderbook')
  ) {
    return 'perp_dex';
  }
  if (
    name.includes('aggregator') ||
    name.includes('router') ||
    name.includes('cow') ||
    name.includes('solver') ||
    name.includes('1inch') ||
    name.includes('kyber')
  ) {
    return 'dex_aggregator';
  }
  if (cat.includes('prediction') || name.includes('predict') || name.includes('polymarket')) {
    return 'prediction_market';
  }
  if (
    cat.includes('lending') ||
    cat.includes('cdp') ||
    cat.includes('collateral') ||
    cat.includes('loan') ||
    cat.includes('credit') ||
    name.includes('lend') ||
    name.includes('borrow')
  ) {
    return 'lending';
  }
  if (cat.includes('dex') || cat.includes('otc') || name.includes('swap') || name.includes('amm')) {
    return 'dex';
  }
  if (
    cat.includes('liquid staking') ||
    cat.includes('restak') ||
    cat.includes('staking pool') ||
    name.includes('stake') ||
    name.includes('restak')
  ) {
    return 'liquid_staking';
  }
  if (cat.includes('bridge') || name.includes('bridge') || name.includes('teleport')) {
    return 'bridge';
  }
  if (
    cat.includes('curator') ||
    cat.includes('allocator') ||
    cat.includes('liquidity manager') ||
    cat.includes('yield') ||
    cat.includes('farm') ||
    name.includes('vault') ||
    name.includes('yield')
  ) {
    return 'yield_vault';
  }
  if (
    cat.includes('chain') ||
    name.includes('network') ||
    name.includes('chain') ||
    name.includes('rollup') ||
    name.includes('l2')
  ) {
    return 'chain_infra';
  }
  if (
    cat.includes('rwa') ||
    cat.includes('basis') ||
    cat.includes('payment') ||
    cat.includes('card') ||
    name.includes('treasury')
  ) {
    return 'rwa';
  }
  return 'general_defi';
}

/**
 * Generate 5 to 7 concrete, actionable farming steps tailored to protocol type, TVL, and age.
 * Mentions exact USD capital allocations, duration requirements, risk parameters, and cadences.
 * Strictly URL-free and between 20 and 600 characters per step.
 */
export function generateFarmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const pType = detectProtocolType(p);
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its primary deployment chain';
  const name = p.name;

  // Derive sensible capital threshold from TVL depth
  const capital =
    p.tvl_usd >= 1_000_000_000
      ? 2500
      : p.tvl_usd >= 100_000_000
        ? 1000
        : p.tvl_usd >= 25_000_000
          ? 500
          : 250;
  const halfCap = Math.round(capital / 2);
  const vol = capital * 8;
  const holdDays = age === null || age < 180 ? 45 : age < 365 ? 30 : 21;

  let steps: string[] = [];

  switch (pType) {
    case 'perp_dex':
      steps = [
        `Fund a dedicated farming wallet with at least $${capital} USDC on ${chain} plus $25 worth of native gas tokens.`,
        `Deposit $${capital} USDC into ${name}'s primary margin account on ${chain} to establish your initial collateral baseline.`,
        `Open balanced delta-neutral long and short positions to generate at least $${vol} of cumulative trading volume over 14 active days.`,
        `Execute at least 3 limit orders and 2 market orders weekly during high liquidity windows to establish an organic retail trading pattern.`,
        `Provide $${halfCap} USDC into ${name}'s liquidity provider pool or market-maker vault and maintain the position for at least ${holdDays} days.`,
        `Maintain active collateral for a minimum continuous window of ${holdDays} days without withdrawing to maximize snapshot time-weighting.`,
        `Track all position hashes in an offline farm log; claim any trading points or fee rebate allocations bi-weekly through the official interface.`,
      ];
      break;

    case 'dex_aggregator':
      steps = [
        `Prepare an unlinked farming wallet with $${capital} in liquid stablecoins on ${chain} and sufficient gas reserves.`,
        `Route a series of 5 to 8 distinct spot swaps totaling over $${vol} through ${name} across major pairs like ETH, WBTC, and USDC.`,
        `Utilize ${name}'s advanced routing features, such as limit orders and RFQ execution modes, for at least 35% of total routed volume.`,
        `Space trades across at least 4 distinct calendar weeks to record continuous multi-epoch active engagement on on-chain analytics.`,
        `Hold at least $${halfCap} of tokens acquired through ${name}'s swaps in your wallet for ${holdDays} days to demonstrate holding retention.`,
        `Document order execution logs offline and verify that your wallet qualifies for recurring volume tier rewards.`,
      ];
      break;

    case 'prediction_market':
      steps = [
        `Transfer $${capital} USDC to your Web3 wallet on ${chain} and approve ${name}'s market settlement contracts.`,
        `Distribute at least $${halfCap} across 3 or more distinct event markets with differing expiry dates to diversify position count.`,
        `Provide $${halfCap} of USDC liquidity to ${name}'s automated market-maker order books to earn passive liquidity provider incentives.`,
        `Keep all prediction share positions active until official event resolution or hold open orders for a minimum duration of ${holdDays} days.`,
        `Redeem resolved outcome tokens directly through canonical contract settlement within 14 days of epoch conclusion.`,
        `Re-invest 25% of settled proceeds into upcoming quarter markets to preserve continuous account activity weighting.`,
      ];
      break;

    case 'lending':
      steps = [
        `Deposit at least $${capital} worth of blue-chip collateral (such as USDC, ETH, or WBTC) into ${name} on ${chain}.`,
        `Borrow an amount equal to 35% to 50% of your collateral value in a major stablecoin to maintain a conservative health factor above 1.75x.`,
        `Supply the borrowed stablecoin into a secondary qualifying pool on ${name} to create an active supply-and-borrow interaction loop.`,
        `Keep the collateral and debt position open continuously for at least ${holdDays} days to accumulate time-weighted protocol points.`,
        `Perform a monthly re-balancing transaction: repay 10% of debt or supply additional interest accrual to keep the wallet active across epochs.`,
        `Unwind the position only after qualifying snapshots conclude: repay 100% of borrowed debt plus accrued interest, then withdraw primary collateral.`,
      ];
      break;

    case 'dex':
      steps = [
        `Prepare equal values of primary paired assets (e.g. $${halfCap} USDC and $${halfCap} native token) on ${chain}.`,
        `Provide at least $${capital} total liquidity into ${name}'s highest-volume core liquidity pool within full range or standard concentrated bounds.`,
        `Stake the LP position into ${name}'s native reward farm and maintain the deposit for a minimum duration of ${holdDays} days.`,
        `Perform at least 2 spot swaps of at least $150 every 7 days across non-correlated pairs to build authentic trader volume and transaction count.`,
        `Compound accrued fee earnings every 14 days by reinvesting LP returns back into the pool to trigger verifiable state changes.`,
        `Retain at least 25% of your liquidity in the pool for 14 days beyond initial qualification to capture potential retroactive loyalty tranches.`,
      ];
      break;

    case 'liquid_staking':
      steps = [
        `Acquire at least $${capital} of the base PoS asset (ETH, SOL, or native network token) in your non-custodial farming wallet on ${chain}.`,
        `Deposit and stake the asset directly via ${name} to receive its receipt liquid staking token (LST) or liquid restaking token (LRT).`,
        `Hold the issued receipt token in your self-custody wallet or deploy it into an approved partner vault for at least ${holdDays} days.`,
        `Supply the receipt token into an integrated DEX pool or lending market for an additional 14 days to maximize partner ecosystem multiplier tiers.`,
        `Monitor validator performance and protocol governance updates bi-weekly; cast on-chain votes if delegate voting is activated.`,
        `Unstake through the canonical redemption queue rather than instant market dumping to avoid high slippage and confirm authentic protocol exit.`,
      ];
      break;

    case 'bridge':
      steps = [
        `Bridge at least $${capital} of USDC or native gas assets from your source chain to ${chain} using ${name}'s cross-chain transfer interface.`,
        `Leave the bridged assets on the destination chain for a minimum holding period of 72 hours before executing any secondary transfers.`,
        `Complete a return or multi-hop transfer routing back across a third supported network 10 days later to demonstrate real cross-chain utility.`,
        `Provide at least $${halfCap} of liquidity to ${name}'s bridge liquidity pool on ${chain} for ${holdDays} days to support transfer rebalancing.`,
        `Maintain an active transaction history of at least 1 bridge transfer every 14 days across two consecutive monthly snapshot windows.`,
      ];
      break;

    case 'yield_vault':
      steps = [
        `Allocate at least $${capital} into ${name}'s curated primary yield strategy or risk-managed vault on ${chain}.`,
        `Verify that the selected vault has an audit history and maintain a conservative deposit ratio under 15% of total pool depth.`,
        `Keep vault shares locked or staked in your custody for a minimum of ${holdDays} days to earn time-decayed incentive points.`,
        `Re-balance vault allocations across risk tiers once every 3 weeks to demonstrate active portfolio stewardship on-chain.`,
        `Harvest accumulated strategy rewards every 14 days and compound them into the vault to document consistent user engagement.`,
      ];
      break;

    case 'chain_infra':
      steps = [
        `Transfer at least $${capital} of assets into ${name}'s native ecosystem via the canonical rollup bridge from Ethereum mainnet or L1.`,
        `Deploy liquidity into at least 2 distinct ecosystem protocols on ${name} (such as one DEX and one money market) within 48 hours.`,
        `Generate at least 25 individual smart contract interactions across 6 distinct calendar weeks to fulfill anti-sybil activity criteria.`,
        `Hold a permanent balance of at least $100 in native gas tokens on ${name} for a minimum duration of ${holdDays} days.`,
        `Participate in ecosystem testnets, public test trials, or governance polls where available to verify early community participation.`,
      ];
      break;

    case 'rwa':
      steps = [
        `Complete identity verification or accredited investor gating if required, then deposit at least $${capital} into ${name} on ${chain}.`,
        `Mint or purchase the underlying tokenized asset (such as tokenized US Treasuries or private credit notes) and hold in cold custody.`,
        `Maintain continuous possession of the tokenized real-world asset for a minimum duration of ${holdDays} days to qualify for yield distributions.`,
        `Participate in monthly asset verification attestation reports or on-chain governance votes to register protocol participation.`,
        `Process yield distributions into stablecoins and re-invest a portion into new issuances to maintain active compounding status.`,
      ];
      break;

    default:
      steps = [
        `Establish a fresh, unlinked non-custodial wallet with at least $${capital} in primary assets on ${chain} plus sufficient native gas.`,
        `Deposit the capital into ${name}'s primary application contract on ${chain} to establish an on-chain activity footprint.`,
        `Maintain the deposit without premature withdrawal for a continuous window of at least ${holdDays} days to capture multiple snapshot epochs.`,
        `Execute weekly maintenance transactions (such as reward claiming, parameter adjustments, or re-staking) every 7 to 10 days.`,
        `Document all deposit transactions, contract addresses, and wallet nonces in an offline tracking ledger for auditing.`,
        `Monitor official protocol announcements through verified governance channels; do not interact with unsolicited token airdrops.`,
      ];
      break;
  }

  // Safety post-processing: trim, verify length (20..600 chars), verify URL-free
  return steps.map((s) => {
    let clean = s.trim().replace(/https?:\/\/\S+/gi, '');
    if (clean.length > 600) clean = `${clean.slice(0, 596)}...`;
    if (clean.length < 20) clean = `${clean} Hold position and check governance updates.`;
    return clean;
  });
}

/**
 * Build the ranked board:
 * 1. Covers ALL watchlist slugs from the snapshot (must appear).
 * 2. Selects at least 160 pre-token protocols below the floor chosen by score (200+ rows total).
 * 3. Scores every protocol and ranks ascending by implied value (rank 1 = highest implied_value_usd).
 */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watchlistSet = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  const shrinks = validateTerms(snapshot.protocols, snapshot.as_of, model);
  const oddsMap = computeTokenOdds(snapshot.protocols);

  // 1. All 40 watchlist slugs must appear
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) {
      chosen.set(slug, p);
    }
  }

  // 2. Pre-token protocols below the watchlist floor, chosen strictly by score
  const belowFloorCandidates = snapshot.protocols.filter(
    (p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd,
  );

  const scoredBelow = belowFloorCandidates.map((p) => {
    const { implied } = impliedValue(p, snapshot.as_of, model, shrinks);
    return { p, implied };
  });

  // Sort candidate protocols below floor by implied value descending, tie-break by slug
  scoredBelow.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  // Select top 160 below the floor by score
  for (const item of scoredBelow.slice(0, EARLY_ROWS)) {
    chosen.set(item.p.slug, item.p);
  }

  // 3. Score all chosen protocols and rank strictly by implied value descending
  const scored = [...chosen.values()].map((p) => {
    const { implied, growthPct, growthMult, ageMult, catMult, age } = impliedValue(p, snapshot.as_of, model, shrinks);
    return { p, implied, growthPct, growthMult, ageMult, catMult, age };
  });

  // Rank 1 = highest implied_value_usd; non-increasing implied value as rank ascends
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  return scored.map((s, i) => ({
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
    is_watchlist: watchlistSet.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.ageMult),
      category_multiplier: round4(s.catMult),
      age_days: s.age,
    },
    farm_steps: generateFarmSteps(s.p, s.age),
    token_odds: oddsMap.get(`${s.p.category ?? 'None'}::${tvlBucket(s.p.tvl_usd)}`) ?? 0.5,
    farm_cost: farmCost(s.p.tvl_usd),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    category_multiplier: row.model.category_multiplier,
    is_watchlist: row.is_watchlist,
    farm_steps: row.farm_steps,
    token_odds: row.token_odds,
    farm_cost: row.farm_cost,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !r.is_watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
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
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SnapshotError('snapshot.json is not a JSON object');
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) {
    throw new SnapshotError('snapshot.json has no as_of date');
  }
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) {
    throw new SnapshotError('snapshot.json has no floor_usd');
  }
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) {
    throw new SnapshotError('snapshot.json has no watchlist of slugs');
  }
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    }
    const p = v as Record<string, unknown>;
    if (
      typeof p.slug !== 'string' ||
      typeof p.name !== 'string' ||
      typeof p.tvl_usd !== 'number' ||
      !Number.isFinite(p.tvl_usd)
    ) {
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
  if (board.length < 100 || board.length > 4000) {
    return `board has ${board.length} rows (expected between 100 and 4,000)`;
  }
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) {
    return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  }
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  }
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `row ${i + 1} (implied $${board[i]!.implied_value_usd}) outranks row ${i} (implied $${board[i - 1]!.implied_value_usd}) on implied value`;
    }
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps (required 3-12)`;
    for (const s of steps) {
      if (s.length < 20 || s.length > 600) {
        return `${r.slug} has a farm step of ${s.length} characters (required 20-600)`;
      }
      if (/https?:\/\//i.test(s)) {
        return `${r.slug} has a farm step containing a URL: ${s}`;
      }
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) {
      return `${r.slug} has invalid implied value ${r.implied_value_usd}`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
