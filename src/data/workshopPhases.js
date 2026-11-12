// Workshop Phases & Day Structure Configuration
// 4 distinct trading days, each exactly 8 minutes long with study breaks in between

export const WORKSHOP_PHASES = [
  {
    day: 1,
    id: 'phase-1',
    name: 'Day 1: Pure Technical Moves',
    shortName: 'Day 1 (Technical Only)',
    startCandle: 375,
    endCandle: 449, // 75 candles
    hasNews: false,
    showPatterns: false,
    durationSeconds: 480, // exactly 8 minutes
    themeColor: '#3b82f6',
    objective:
      'Starting easy: Prices move purely on technical indicators, moving averages (SMA 20/50), VWAP, and support/resistance bounces. Zero news distractions.',
    studyFocus:
      'Look for Golden Crosses (SMA 20 crossing above SMA 50), RSI swings between 30 and 70, and VWAP trend confirmation.',
  },
  {
    day: 2,
    id: 'phase-2',
    name: 'Day 2: News Catalysts & Candlestick Patterns',
    shortName: 'Day 2 (News + Patterns)',
    startCandle: 450,
    endCandle: 524, // 75 candles
    hasNews: true,
    showPatterns: true,
    durationSeconds: 480, // exactly 8 minutes
    themeColor: '#10b981',
    objective:
      'Sector news arrives and directly impacts company stock prices! Candlestick patterns (Hammers, Bullish/Bearish Engulfing, Dojis) begin triggering on chart.',
    studyFocus:
      'Trade the news breakout! Watch how breaking announcements align with candlestick reversal patterns to create high-probability setups.',
  },
  {
    day: 3,
    id: 'phase-3',
    name: 'Day 3: Macro Shocks & Commodity Volatility',
    shortName: 'Day 3 (Macro Volatility)',
    startCandle: 525,
    endCandle: 599, // 75 candles
    hasNews: true,
    showPatterns: true,
    durationSeconds: 480, // exactly 8 minutes
    themeColor: '#f59e0b',
    objective:
      'Macroeconomic shocks (Crude Oil jumps, bond yield shifts, inflation prints) cause divergent market reactions across sectors.',
    studyFocus:
      'Learn sector divergence: see how oil spikes lift Reliance but pressure Tata Motors. Look for Morning Star reversals at key support.',
  },
  {
    day: 4,
    id: 'phase-4',
    name: 'Day 4: Competition Grand Finale',
    shortName: 'Day 4 (Final Countdown)',
    startCandle: 600,
    endCandle: 674, // 75 candles
    hasNews: true,
    showPatterns: true,
    durationSeconds: 480, // exactly 8 minutes
    themeColor: '#ec4899',
    objective:
      'The decisive final session! GDP surprises and corporate earnings wave. Manage portfolio risk as participants battle for 1st place on the leaderboard.',
    studyFocus:
      'Protect your gains or take high-conviction momentum trades before the final closing bell!',
  },
];

export function getPhaseForCandle(candleIndex) {
  if (candleIndex < WORKSHOP_PHASES[0].startCandle) {
    return {
      day: 0,
      name: 'Pre-Market 1-Week Study History',
      shortName: '1-Week Warm-Up',
      hasNews: false,
      showPatterns: false,
      themeColor: '#64748b',
    };
  }

  for (const phase of WORKSHOP_PHASES) {
    if (candleIndex >= phase.startCandle && candleIndex <= phase.endCandle) {
      return phase;
    }
  }

  return {
    day: 5,
    name: 'Competition Finished',
    shortName: 'Finished',
    hasNews: true,
    showPatterns: true,
    themeColor: '#fbbf24',
  };
}

