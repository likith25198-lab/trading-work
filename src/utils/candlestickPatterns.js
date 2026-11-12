// Candlestick Pattern Detection Engine for Trading Workshop Learning

export const PATTERN_DEFINITIONS = {
  BULLISH_ENGULFING: {
    name: 'Bullish Engulfing',
    type: 'BULLISH',
    icon: '⚡',
    color: '#10b981',
    description: 'A large green body completely wraps over the prior red candle. Strong buying takeover.',
  },
  BEARISH_ENGULFING: {
    name: 'Bearish Engulfing',
    type: 'BEARISH',
    icon: '🔻',
    color: '#ef4444',
    description: 'A large red candle swallows the prior green candle. Sellers seize control.',
  },
  HAMMER: {
    name: 'Hammer (Bullish Pin Bar)',
    type: 'BULLISH',
    icon: '🔨',
    color: '#10b981',
    description: 'Long lower shadow (2x body) rejecting lows near support. Reversal signal.',
  },
  SHOOTING_STAR: {
    name: 'Shooting Star (Bearish Pin Bar)',
    type: 'BEARISH',
    icon: '☄',
    color: '#ef4444',
    description: 'Long upper shadow (2x body) rejecting highs near resistance. Bearish exhaustion.',
  },
  MORNING_STAR: {
    name: 'Morning Star',
    type: 'BULLISH',
    icon: '✨',
    color: '#10b981',
    description: '3-candle bottom reversal: tall red candle, small indecision body, and strong green breakout.',
  },
  EVENING_STAR: {
    name: 'Evening Star',
    type: 'BEARISH',
    icon: '🌑',
    color: '#ef4444',
    description: '3-candle top reversal: tall green candle, small star body, followed by deep red selloff.',
  },
  DOJI: {
    name: 'Doji (Indecision)',
    type: 'NEUTRAL',
    icon: '➕',
    color: '#fbbf24',
    description: 'Open and close are virtually identical. Market balance waiting for a catalyst.',
  },
};

/**
 * Scans candle history and returns detected patterns
 */
export function detectCandlestickPatterns(candles, minIndex = 0) {
  if (!candles || candles.length < 3) return [];
  const detected = [];

  for (let i = Math.max(2, minIndex); i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const prev2 = candles[i - 2];

    const range = c.high - c.low;
    if (range <= 0) continue;

    const body = Math.abs(c.close - c.open);
    const isGreen = c.close >= c.open;
    const isRed = c.close < c.open;
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    const prevRange = prev.high - prev.low;
    const prevBody = Math.abs(prev.close - prev.open);
    const prevIsRed = prev.close < prev.open;
    const prevIsGreen = prev.close >= prev.open;

    // 1. Doji
    if (body <= range * 0.08 && range > 0.5) {
      detected.push({
        index: i,
        time: c.time,
        displayTime: c.displayTime,
        pattern: 'DOJI',
        ...PATTERN_DEFINITIONS.DOJI,
        price: c.close,
      });
      continue;
    }

    // 2. Hammer / Bullish Pin Bar
    if (lowerWick >= body * 2.0 && upperWick <= body * 0.35 && body >= range * 0.15) {
      if (prevIsRed || c.close < prev.close) {
        detected.push({
          index: i,
          time: c.time,
          displayTime: c.displayTime,
          pattern: 'HAMMER',
          ...PATTERN_DEFINITIONS.HAMMER,
          price: c.low,
        });
        continue;
      }
    }

    // 3. Shooting Star / Bearish Pin Bar
    if (upperWick >= body * 2.0 && lowerWick <= body * 0.35 && body >= range * 0.15) {
      if (prevIsGreen || c.close > prev.close) {
        detected.push({
          index: i,
          time: c.time,
          displayTime: c.displayTime,
          pattern: 'SHOOTING_STAR',
          ...PATTERN_DEFINITIONS.SHOOTING_STAR,
          price: c.high,
        });
        continue;
      }
    }

    // 4. Bullish Engulfing
    if (
      prevIsRed &&
      isGreen &&
      c.open <= prev.close + 0.5 &&
      c.close >= prev.open &&
      body > prevBody * 1.15
    ) {
      detected.push({
        index: i,
        time: c.time,
        displayTime: c.displayTime,
        pattern: 'BULLISH_ENGULFING',
        ...PATTERN_DEFINITIONS.BULLISH_ENGULFING,
        price: c.low,
      });
      continue;
    }

    // 5. Bearish Engulfing
    if (
      prevIsGreen &&
      isRed &&
      c.open >= prev.close - 0.5 &&
      c.close <= prev.open &&
      body > prevBody * 1.15
    ) {
      detected.push({
        index: i,
        time: c.time,
        displayTime: c.displayTime,
        pattern: 'BEARISH_ENGULFING',
        ...PATTERN_DEFINITIONS.BEARISH_ENGULFING,
        price: c.high,
      });
      continue;
    }

    // 6. Morning Star (3 candles)
    if (
      prev2.close < prev2.open &&
      Math.abs(prev2.close - prev2.open) >= prevRange * 0.45 &&
      prevBody <= prev2.high - prev2.low * 0.25 &&
      isGreen &&
      c.close >= (prev2.open + prev2.close) / 2
    ) {
      detected.push({
        index: i,
        time: c.time,
        displayTime: c.displayTime,
        pattern: 'MORNING_STAR',
        ...PATTERN_DEFINITIONS.MORNING_STAR,
        price: c.low,
      });
      continue;
    }

    // 7. Evening Star (3 candles)
    if (
      prev2.close > prev2.open &&
      Math.abs(prev2.close - prev2.open) >= prevRange * 0.45 &&
      prevBody <= prev2.high - prev2.low * 0.25 &&
      isRed &&
      c.close <= (prev2.open + prev2.close) / 2
    ) {
      detected.push({
        index: i,
        time: c.time,
        displayTime: c.displayTime,
        pattern: 'EVENING_STAR',
        ...PATTERN_DEFINITIONS.EVENING_STAR,
        price: c.high,
      });
      continue;
    }
  }

  return detected;
}

