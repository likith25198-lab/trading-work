// Technical Analysis Indicators

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    result.push(parseFloat((sum / period).toFixed(2)));
  }
  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(data, period) {
  const result = [];
  if (data.length < period) {
    return data.map(() => null);
  }
  const multiplier = 2 / (period + 1);

  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
    result.push(null);
  }
  result[period - 1] = parseFloat((sum / period).toFixed(2));

  for (let i = period; i < data.length; i++) {
    const ema = (data[i].close - result[i - 1]) * multiplier + result[i - 1];
    result.push(parseFloat(ema.toFixed(2)));
  }
  return result;
}

/**
 * Relative Strength Index (RSI) using Wilder's smoothing
 */
export function calculateRSI(data, period = 14) {
  const result = [];
  if (data.length === 0) return result;

  const gains = [];
  const losses = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }

    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    gains.push(gain);
    losses.push(loss);

    if (i < period) {
      result.push(null);
      continue;
    }

    if (i === period) {
      avgGain = gains.reduce((a, b) => a + b, 0) / period;
      avgLoss = losses.reduce((a, b) => a + b, 0) / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(parseFloat((100 - 100 / (1 + rs)).toFixed(2)));
    }
  }
  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const macdLine = [];
  const signalLine = [];
  const histogram = [];

  // Calculate MACD line
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(parseFloat((fastEMA[i] - slowEMA[i]).toFixed(2)));
    }
  }

  // Calculate Signal line (EMA of MACD)
  const signalMultiplier = 2 / (signalPeriod + 1);
  let signalIdx = 0;
  let signalSum = 0;
  let signalEma = null;

  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
      histogram.push(null);
      continue;
    }

    signalIdx++;
    if (signalIdx <= signalPeriod) {
      signalSum += macdLine[i];
      if (signalIdx === signalPeriod) {
        signalEma = signalSum / signalPeriod;
        signalLine.push(parseFloat(signalEma.toFixed(2)));
        histogram.push(parseFloat((macdLine[i] - signalEma).toFixed(2)));
      } else {
        signalLine.push(null);
        histogram.push(null);
      }
    } else {
      signalEma = (macdLine[i] - signalEma) * signalMultiplier + signalEma;
      signalLine.push(parseFloat(signalEma.toFixed(2)));
      histogram.push(parseFloat((macdLine[i] - signalEma).toFixed(2)));
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(data, period = 20, stdDev = 2) {
  const sma = calculateSMA(data, period);
  const upper = [];
  const lower = [];

  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }

    let sumSqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSqDiff += Math.pow(data[j].close - sma[i], 2);
    }
    const std = Math.sqrt(sumSqDiff / period);

    upper.push(parseFloat((sma[i] + stdDev * std).toFixed(2)));
    lower.push(parseFloat((sma[i] - stdDev * std).toFixed(2)));
  }

  return { middle: sma, upper, lower };
}

/**
 * Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(data) {
  const result = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let currentDate = data[0]?.dateStr;

  for (let i = 0; i < data.length; i++) {
    // Reset on new day
    if (data[i].dateStr !== currentDate) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      currentDate = data[i].dateStr;
    }

    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    cumulativeTPV += typicalPrice * data[i].volume;
    cumulativeVolume += data[i].volume;

    result.push(parseFloat((cumulativeTPV / cumulativeVolume).toFixed(2)));
  }

  return result;
}

/**
 * Stochastic Oscillator
 */
export function calculateStochastic(data, kPeriod = 14, dPeriod = 3) {
  const kValues = [];
  const dValues = [];

  for (let i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(null);
      continue;
    }

    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      highestHigh = Math.max(highestHigh, data[j].high);
      lowestLow = Math.min(lowestLow, data[j].low);
    }

    const range = highestHigh - lowestLow;
    const k = range === 0 ? 50 : ((data[i].close - lowestLow) / range) * 100;
    kValues.push(parseFloat(k.toFixed(2)));
  }

  // Calculate %D (SMA of %K)
  for (let i = 0; i < kValues.length; i++) {
    if (kValues[i] === null || i < kPeriod - 1 + dPeriod - 1) {
      dValues.push(null);
      continue;
    }

    let sum = 0;
    let count = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      if (kValues[j] !== null) {
        sum += kValues[j];
        count++;
      }
    }
    dValues.push(count > 0 ? parseFloat((sum / count).toFixed(2)) : null);
  }

  return { k: kValues, d: dValues };
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(data, period = 14) {
  const trValues = [];
  const atrValues = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trValues.push(data[i].high - data[i].low);
      atrValues.push(null);
      continue;
    }

    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    );
    trValues.push(tr);

    if (i < period) {
      atrValues.push(null);
      continue;
    }

    if (i === period) {
      const sum = trValues.slice(0, period + 1).reduce((a, b) => a + b, 0);
      atrValues.push(parseFloat((sum / (period + 1)).toFixed(2)));
    } else {
      const prevATR = atrValues[i - 1];
      const atr = (prevATR * (period - 1) + tr) / period;
      atrValues.push(parseFloat(atr.toFixed(2)));
    }
  }

  return atrValues;
}

/**
 * Support and Resistance levels (pivot points)
 */
export function calculatePivotPoints(data, index) {
  if (index < 1) return null;
  
  // Use previous candle for pivot calculation
  const prev = data[index - 1];
  const pivot = (prev.high + prev.low + prev.close) / 3;
  
  return {
    pivot: parseFloat(pivot.toFixed(2)),
    r1: parseFloat((2 * pivot - prev.low).toFixed(2)),
    r2: parseFloat((pivot + (prev.high - prev.low)).toFixed(2)),
    s1: parseFloat((2 * pivot - prev.high).toFixed(2)),
    s2: parseFloat((pivot - (prev.high - prev.low)).toFixed(2)),
  };
}

