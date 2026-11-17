// Deterministic pre-programmed stock trading dataset for workshop learning

function createSeededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SIM_INITIAL_CANDLES = 375; // 5 full trading days (1 week) * 75 candles/day

const MARKET_PHASES = [
  { duration: 45, drift: 0.0004, volScale: 0.85, label: 'Accumulation', tip: 'Sideways range with low volatility — watch Bollinger Bands squeeze before a move.' },
  { duration: 55, drift: 0.0022, volScale: 1.15, label: 'Bullish Breakout', tip: 'Price breaks above resistance with rising volume and SMA 20 crossing above SMA 50.' },
  { duration: 35, drift: -0.0014, volScale: 1.0, label: 'Healthy Pullback', tip: 'RSI cools down from overbought (>70) toward 50 as early buyers take profits.' },
  { duration: 60, drift: 0.0026, volScale: 1.25, label: 'Momentum Rally', tip: 'Strong uptrend! Price rides above EMA 12 and VWAP; MACD histogram expands.' },
  { duration: 40, drift: -0.0002, volScale: 0.75, label: 'Consolidation', tip: 'Tight range after a rally — traders look for support/resistance levels.' },
  { duration: 45, drift: -0.0028, volScale: 1.45, label: 'Sharp Selloff', tip: 'High-volume breakdown below moving averages. Notice RSI approaching oversold (<30).' },
  { duration: 35, drift: 0.0005, volScale: 1.1, label: 'Bottoming Base', tip: 'Double-bottom / support test near S1. Watch for bullish MACD crossover.' },
  { duration: 65, drift: 0.0020, volScale: 1.05, label: 'Trend Recovery', tip: 'Price reclaims VWAP and SMA 20 as buyers step back in.' },
  { duration: 40, drift: -0.0012, volScale: 0.95, label: 'Distribution', tip: 'Momentum slows near resistance (R1/R2) — watch for divergence on RSI.' },
  { duration: 70, drift: 0.0016, volScale: 1.2, label: 'Late Session Surge', tip: 'Volume expands into the trend move; Stochastic & MACD confirm direction.' },
];

function generateIntradayData(symbol, seed, startPrice, baseVolatility, phaseOffset = 0, tradingDays = 30) {
  const rng = createSeededRng(seed);
  const data = [];
  let price = startPrice;
  const startDate = new Date(Date.UTC(2025, 0, 6, 9, 15, 0)); // Mon Jan 6 2025 09:15 UTC
  const candlesPerDay = 75; // 5-min candles per session

  let phaseIdx = phaseOffset % MARKET_PHASES.length;
  let phaseStep = 0;
  let dayCount = 0;

  for (let d = 0; d < tradingDays * 2; d++) {
    const dayDate = new Date(startDate.getTime() + d * 86400000);
    const dow = dayDate.getUTCDay();
    if (dow === 0 || dow === 6) continue;

    dayCount++;
    if (dayCount > tradingDays) break;

    for (let c = 0; c < candlesPerDay; c++) {
      const candleMs = dayDate.getTime() + c * 5 * 60 * 1000;
      const timeSec = Math.floor(candleMs / 1000);
      const dt = new Date(candleMs);
      const dateStr = dt.toISOString().split('T')[0];
      const hh = String(dt.getUTCHours()).padStart(2, '0');
      const mm = String(dt.getUTCMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;

      const phase = MARKET_PHASES[phaseIdx % MARKET_PHASES.length];

      // Intraday U-shaped volume/volatility curve (higher near open and close)
      const sessionPos = c / candlesPerDay;
      const intradayFactor = 0.85 + 0.65 * Math.pow(sessionPos - 0.5, 2) * 4;

      // Box-Muller-like pseudo-normal shock from seeded rng
      const u1 = Math.max(0.0001, rng());
      const u2 = rng();
      const normalShock = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

      const stepReturn =
        phase.drift + normalShock * baseVolatility * phase.volScale * intradayFactor;

      const open = price;
      const close = Math.max(startPrice * 0.35, open * (1 + stepReturn));
      const wickRange = baseVolatility * open * phase.volScale * intradayFactor;
      const high = Math.max(open, close) + rng() * wickRange * 0.65;
      const low = Math.max(1, Math.min(open, close) - rng() * wickRange * 0.65);

      const movePct = Math.abs(close - open) / open;
      const volume = Math.floor(
        (45000 + rng() * 140000) * phase.volScale * intradayFactor * (1 + movePct * 65)
      );

      data.push({
        time: timeSec,
        displayTime: `${dateStr} ${timeStr}`,
        dateStr,
        timeStr,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
        phase: phase.label,
        tip: phase.tip,
      });

      price = close;
      phaseStep++;
      if (phaseStep >= phase.duration) {
        phaseStep = 0;
        phaseIdx++;
      }
    }
  }

  return data;
}

export const STOCKS = {
  RELIANCE: {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    sector: 'Energy & Telecom',
    color: '#3b82f6',
    description: 'Large-cap bellwether with clean trend swings & strong breakouts.',
    data: generateIntradayData('RELIANCE', 104729, 2480, 0.0042, 0, 30),
  },
  TCS: {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    sector: 'IT Services',
    color: '#10b981',
    description: 'Steady trend follower — ideal for practicing Moving Average crossovers.',
    data: generateIntradayData('TCS', 208391, 3680, 0.0034, 2, 30),
  },
  TATAMOTORS: {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    sector: 'Automobile',
    color: '#ef4444',
    description: 'High-beta mover with fast swings — great for RSI & Bollinger Band scalps.',
    data: generateIntradayData('TATAMOTORS', 319483, 720, 0.0062, 1, 30),
  },
  HDFCBANK: {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    sector: 'Banking',
    color: '#8b5cf6',
    description: 'Mean-reverting banking giant — great for Support/Resistance & VWAP.',
    data: generateIntradayData('HDFCBANK', 427105, 1640, 0.0038, 4, 30),
  },
  INFY: {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    sector: 'IT Services',
    color: '#f59e0b',
    description: 'Responsive to momentum & MACD signals with crisp intraday pullbacks.',
    data: generateIntradayData('INFY', 539281, 1510, 0.0046, 3, 30),
  },
  WIPRO: {
    symbol: 'WIPRO',
    name: 'Wipro Ltd',
    sector: 'IT Services',
    color: '#06b6d4',
    description: 'Affordable per-share price for practicing position sizing and risk.',
    data: generateIntradayData('WIPRO', 648193, 465, 0.0052, 5, 30),
  },
  ICICIBANK: {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    sector: 'Banking',
    color: '#f97316',
    description: 'High-growth private banking leader with strong retail loan growth and momentum.',
    data: generateIntradayData('ICICIBANK', 759204, 1080, 0.0048, 2, 30),
  },
  ITC: {
    symbol: 'ITC',
    name: 'ITC Ltd',
    sector: 'FMCG',
    color: '#14b8a6',
    description: 'Defensive FMCG powerhouse — ideal for low-beta trend following and consolidation bases.',
    data: generateIntradayData('ITC', 872019, 460, 0.0031, 5, 30),
  },
  SBIN: {
    symbol: 'SBIN',
    name: 'State Bank of India',
    sector: 'PSU Banking',
    color: '#0284c7',
    description: 'India’s largest public sector lender — bellwether for credit expansion and interest rate cycles.',
    data: generateIntradayData('SBIN', 983142, 785, 0.0055, 3, 30),
  },
  BHARTIARTL: {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd',
    sector: 'Telecom',
    color: '#e11d48',
    description: 'Telecom and 5G heavyweight driven by ARPU growth, tariff hikes, and digital services.',
    data: generateIntradayData('BHARTIARTL', 361928, 1260, 0.0044, 4, 30),
  },
  LT: {
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd',
    sector: 'Infrastructure',
    color: '#eab308',
    description: 'Infrastructure and engineering colossus — high-conviction breakout trades on capex orders.',
    data: generateIntradayData('LT', 492817, 3540, 0.0049, 1, 30),
  },
};

export const STOCK_LIST = Object.values(STOCKS);

export const WORKSHOP_JUMP_POINTS = [
  { label: 'Day 1: Pure Technical Analysis', index: 375, desc: 'Phase 1: 1-week warm-up history loaded; purely technical moves with moving averages & indicators' },
  { label: 'Day 2: News & Candlestick Patterns', index: 450, desc: 'Phase 2: Breaking sector news begins impacting stocks; hammer and engulfing patterns appear' },
  { label: 'Day 3: Macro & Commodity Volatility', index: 525, desc: 'Phase 3: Crude oil shock & inflation prints test risk management' },
  { label: 'Day 4: Competition Grand Finale', index: 600, desc: 'Phase 4: GDP surge & bank recovery rally before the final competition closing bell' },
];

export const WORKSHOP_NEWS_EVENTS = [
  // --- DAY 2: SECTOR CATALYSTS & PATTERNS (Candles 450 - 524) ---
  {
    id: 'news-day2-1',
    candleIndex: 462,
    category: 'Telecom & Digital',
    type: 'sector',
    badgeColor: '#e11d48',
    headline: 'TRAI Recommends 5G Tariff Floor & Spectrum Rationalization: Industry ARPU Poised for Double-Digit Growth',
    summary:
      'The telecom regulatory body released recommendations approving floor pricing mechanisms and rationalized spectrum usage fees, paving the way for sustainable Average Revenue Per User (ARPU) expansion.',
    impactSummary: 'Strong Structural Tailwinds for Telecom Heavyweights',
    impactedStocks: [
      { symbol: 'BHARTIARTL', direction: 'BULLISH', effect: '+4.2% Tariff Hike & ARPU Expansion' },
      { symbol: 'RELIANCE', direction: 'BULLISH', effect: '+2.5% Digital Services Monetization' },
    ],
    workshopTakeaway:
      'Regulatory tariff reforms improve EBITDA margins across capital-intensive sectors. Watch for bullish hammer and morning star reversals bouncing off the 20-period moving average.',
  },
  {
    id: 'news-day2-2',
    candleIndex: 478,
    category: 'IT Sector',
    type: 'sector',
    badgeColor: '#3b82f6',
    headline: 'US Enterprise Tech Spend Surges: Fortune 50 Inks $2.8B Multi-Year Cloud & AI Contract',
    summary:
      'Leading North American enterprises raised their digital transformation and AI capex by 22% QoQ. Indian tier-1 IT firms secure key vendor consolidation bids.',
    impactSummary: 'Explosive Momentum across IT Services Blue-Chips',
    impactedStocks: [
      { symbol: 'TCS', direction: 'BULLISH', effect: '+4.1% Deal Win Momentum' },
      { symbol: 'INFY', direction: 'BULLISH', effect: '+3.9% Revenue Guidance Upgrade' },
      { symbol: 'WIPRO', direction: 'BULLISH', effect: '+3.2% Volume Surge' },
    ],
    workshopTakeaway:
      'Sector-specific demand tailwinds create sector rotation rallies. Watch MACD histogram expand and EMA 12 cross above EMA 26 on IT stocks.',
  },
  {
    id: 'news-day2-3',
    candleIndex: 495,
    category: 'Automobile Sector',
    type: 'sector',
    badgeColor: '#10b981',
    headline: 'Cabinet Clears ₹14,500 Cr EV & Clean Mobility Subsidy Phase-3',
    summary:
      'The Ministry of Heavy Industries approved expanded subsidies for electric buses, commercial fleets, and battery production, strongly favoring domestic OEMs.',
    impactSummary: 'High-Volume Breakout Catalyst for Auto Manufacturers',
    impactedStocks: [
      { symbol: 'TATAMOTORS', direction: 'BULLISH', effect: '+5.6% EV Market Share Dominance' },
      { symbol: 'RELIANCE', direction: 'BULLISH', effect: '+1.8% Clean Energy Gigafactory' },
    ],
    workshopTakeaway:
      'Government policy subsidies generate decisive breakout candles. Look for candles piercing upper Bollinger Bands with 3x average volume.',
  },
  {
    id: 'news-day2-4',
    candleIndex: 512,
    category: 'FMCG & Consumption',
    type: 'sector',
    badgeColor: '#14b8a6',
    headline: 'Rural FMCG Demand Rebounds 14% on Bumper Rabi Harvest & Rising Disposable Incomes',
    summary:
      'Nielsen and consumer index reports confirmed strong double-digit volume recovery in semi-urban and rural markets following higher agricultural realizations and stable input costs.',
    impactSummary: 'Volume Expansion for Consumer Staples & Retail Credit',
    impactedStocks: [
      { symbol: 'ITC', direction: 'BULLISH', effect: '+3.4% Rural Volume Surge' },
      { symbol: 'ICICIBANK', direction: 'BULLISH', effect: '+2.1% Rural Credit Disbursal' },
    ],
    workshopTakeaway:
      'Rural volume recoveries create steady accumulation bases. Look for golden crosses as SMA 20 crosses above SMA 50 with rising volume.',
  },

  // --- DAY 3: MACRO SHOCKS & COMMODITY VOLATILITY (Candles 525 - 599) ---
  {
    id: 'news-day3-1',
    candleIndex: 536,
    category: 'Macro & Commodity',
    type: 'macro',
    badgeColor: '#f97316',
    headline: 'Brent Crude Spikes +6.8% to $94/bbl on Supply & Tanker Route Disruption',
    summary:
      'Global oil prices jump following unexpected shipping lane bottlenecks and strategic stockpile replenishment. Refining crack spreads for diesel and jet fuel reach multi-month highs.',
    impactSummary: 'Divergence: Windfall for Refiners, Margin Squeeze on Auto & Transport',
    impactedStocks: [
      { symbol: 'RELIANCE', direction: 'BULLISH', effect: '+4.5% Gross Refining Margins (GRM)' },
      { symbol: 'TATAMOTORS', direction: 'BEARISH', effect: '-2.4% Fleet Operating Cost Headwind' },
      { symbol: 'HDFCBANK', direction: 'NEUTRAL', effect: 'Watching Inflationary Pressure' },
    ],
    workshopTakeaway:
      'Commodity shocks do not affect all stocks equally. Reliance breaks out toward resistance while Tata Motors experiences a pullback to support.',
  },
  {
    id: 'news-day3-2',
    candleIndex: 554,
    category: 'Infra & Capital Goods',
    type: 'sector',
    badgeColor: '#eab308',
    headline: 'National Rail & Expressways Corridor Awards Mega ₹48,000 Cr High-Speed EPC Contracts',
    summary:
      'The National Infrastructure Pipeline awarded mega contracts for dedicated high-speed rail lines and expressways, leading to historic order book additions for domestic engineering leaders.',
    impactSummary: 'Order Book Boom for Construction & Project Lenders',
    impactedStocks: [
      { symbol: 'LT', direction: 'BULLISH', effect: '+5.4% Order Book All-Time High' },
      { symbol: 'SBIN', direction: 'BULLISH', effect: '+2.8% Consortium Loan Disbursals' },
      { symbol: 'TATAMOTORS', direction: 'BULLISH', effect: '+1.8% Commercial Tipper Orders' },
    ],
    workshopTakeaway:
      'Mega infrastructure contract awards create gap-up breakouts above resistance lines (R1/R2). Trade the trend pullback to VWAP.',
  },
  {
    id: 'news-day3-3',
    candleIndex: 572,
    category: 'Macro Economics',
    type: 'macro',
    badgeColor: '#dc2626',
    headline: 'Hot CPI Inflation Print (6.7%) Sparks Panic of Aggressive Central Bank Tightening',
    summary:
      'Domestic consumer price inflation exceeded consensus estimates due to rising commodity and logistics costs. Sovereign bond yields spike 18 bps as traders price in emergency rate hikes.',
    impactSummary: 'Broad Market Correction & High-Beta Profit Taking',
    impactedStocks: [
      { symbol: 'TATAMOTORS', direction: 'BEARISH', effect: '-3.8% High-Beta Valuation Reset' },
      { symbol: 'INFY', direction: 'BEARISH', effect: '-3.2% Tech Growth Multiple Contraction' },
      { symbol: 'HDFCBANK', direction: 'BEARISH', effect: '-2.5% Bond Portfolio Mark-to-Market' },
      { symbol: 'ICICIBANK', direction: 'BEARISH', effect: '-2.3% Cost of Deposits Pressure' },
    ],
    workshopTakeaway:
      'Macro inflation shocks trigger sharp selloffs. Watch RSI drop from overbought (>70) straight toward oversold (<30) as moving averages breakdown.',
  },
  {
    id: 'news-day3-4',
    candleIndex: 588,
    category: 'Defensive & FMCG',
    type: 'sector',
    badgeColor: '#14b8a6',
    headline: 'Institutional Flight to Safety: Capital Rotates into High-Dividend Defensive Leaders',
    summary:
      'Facing bond yield spikes and equity volatility, domestic mutual funds and pension funds rotated capital aggressively out of cyclicals into high-dividend, debt-free consumer staples.',
    impactSummary: 'Defensive Inflow Sanctuary for Resilient Cash-Flow Kings',
    impactedStocks: [
      { symbol: 'ITC', direction: 'BULLISH', effect: '+3.6% Institutional Flight to Quality' },
      { symbol: 'SBIN', direction: 'BEARISH', effect: '-1.8% Sovereign Yield Volatility' },
    ],
    workshopTakeaway:
      'In volatile bear phases, smart money rotates into defensive FMCG. Notice how ITC decouples from broad index drops and breaks out.',
  },

  // --- DAY 4: COMPETITION GRAND FINALE (Candles 600 - 674) ---
  {
    id: 'news-day4-1',
    candleIndex: 612,
    category: 'Banking & Legal',
    type: 'sector',
    badgeColor: '#10b981',
    headline: 'Supreme Court Clears Mega Resolution Plan, Unlocking ₹32,000 Cr in Stressed Debt',
    summary:
      'A landmark judicial ruling approved the debt restructuring of major legacy corporate borrowers, enabling commercial lenders to write back provisions directly into tier-1 net capital.',
    impactSummary: 'Asset Quality Rebound for Heavyweight Financials',
    impactedStocks: [
      { symbol: 'HDFCBANK', direction: 'BULLISH', effect: '+4.2% Bad-Loan Recovery & Tier-1 Capital' },
      { symbol: 'SBIN', direction: 'BULLISH', effect: '+4.8% Direct Provision Write-Back' },
      { symbol: 'ICICIBANK', direction: 'BULLISH', effect: '+3.8% NIM Margin Expansion' },
      { symbol: 'RELIANCE', direction: 'BULLISH', effect: '+2.1% Strategic Asset Takeover' },
    ],
    workshopTakeaway:
      'Balance sheet healing creates sustainable bottoming patterns (Double Bottom). Look for RSI bullish divergence and price bouncing off Support S1.',
  },
  {
    id: 'news-day4-2',
    candleIndex: 628,
    category: 'Semiconductor & Tech',
    type: 'sector',
    badgeColor: '#38bdf8',
    headline: 'Global Tech Consortium Finalizes $10B Semiconductor Fabrication Facility in India',
    summary:
      'An international consortium together with leading domestic conglomerates inked definitive agreements to break ground on a cutting-edge 28nm semiconductor wafer foundry and OSAT hub.',
    impactSummary: 'Industrial EPC & High-Tech Infrastructure Multiplier',
    impactedStocks: [
      { symbol: 'LT', direction: 'BULLISH', effect: '+4.2% Cleanroom & EPC Construction' },
      { symbol: 'TCS', direction: 'BULLISH', effect: '+3.1% Semiconductor Design & AI Systems' },
      { symbol: 'BHARTIARTL', direction: 'BULLISH', effect: '+2.6% Dedicated Enterprise 5G Mesh' },
    ],
    workshopTakeaway:
      'Mega high-tech CAPEX news creates sustained multi-hour trend continuation. Maintain trailing stop-losses just below EMA 12.',
  },
  {
    id: 'news-day4-3',
    candleIndex: 648,
    category: 'Macro Economics',
    type: 'macro',
    badgeColor: '#10b981',
    headline: 'Q4 GDP Accelerates to 7.8% as Capital Expenditure & Manufacturing Beat Expectations',
    summary:
      'National statistics bureau released Q4 economic data showing robust double-digit growth in gross fixed capital formation, power consumption, and credit demand across manufacturing clusters.',
    impactSummary: 'All-Around Bullish Institutional Inflow Wave',
    impactedStocks: [
      { symbol: 'RELIANCE', direction: 'BULLISH', effect: '+3.7% Industrial Demand Rebound' },
      { symbol: 'TATAMOTORS', direction: 'BULLISH', effect: '+4.6% Heavy Commercial Vehicle Surge' },
      { symbol: 'HDFCBANK', direction: 'BULLISH', effect: '+3.1% Retail & MSME Credit Expansion' },
      { symbol: 'ICICIBANK', direction: 'BULLISH', effect: '+3.0% Corporate Loan Growth' },
      { symbol: 'TCS', direction: 'BULLISH', effect: '+2.5% Broad Market Inflow' },
    ],
    workshopTakeaway:
      'Strong macroeconomic fundamentals support long-term trend continuation. Price rides above VWAP with golden crosses on all timeframes.',
  },
  {
    id: 'news-day4-4',
    candleIndex: 662,
    category: 'Institutional Flows',
    type: 'macro',
    badgeColor: '#a855f7',
    headline: 'Closing Bell Inflow Surge: FIIs Pump Record ₹9,200 Cr in Final-Hour Benchmark Index Rebalancing',
    summary:
      'Global emerging market indices executed their semi-annual weight increases in the final 30 minutes of trade, generating a torrential wave of market-on-close index buying across blue-chips.',
    impactSummary: 'Final-Hour High-Volume Liquidity Surge Across All Leaders',
    impactedStocks: [
      { symbol: 'RELIANCE', direction: 'BULLISH', effect: '+2.8% Passive Index Allocation' },
      { symbol: 'ICICIBANK', direction: 'BULLISH', effect: '+3.4% Institutional Inflow Wave' },
      { symbol: 'LT', direction: 'BULLISH', effect: '+2.9% Weightage Upgrade' },
      { symbol: 'SBIN', direction: 'BULLISH', effect: '+2.4% PSU Banking Inflow' },
      { symbol: 'ITC', direction: 'BULLISH', effect: '+2.1% Closing Squeeze' },
    ],
    workshopTakeaway:
      'The final competition sprint! Institutional rebalancing drives massive liquidity for participants closing winning breakout trades before the final gong.',
  },
];
