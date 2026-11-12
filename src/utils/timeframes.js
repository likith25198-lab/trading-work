// Multi-timeframe candle aggregator
// Aggregates base 5-minute pre-programmed candles into 15m, 1h, and 1D (Daily)

export const TIMEFRAMES = [
  { id: '5m', label: '5m', name: '5 Minutes' },
  { id: '15m', label: '15m', name: '15 Minutes' },
  { id: '1h', label: '1h', name: '1 Hour' },
  { id: '1D', label: '1D', name: 'Daily' },
];

export function aggregateCandles(baseCandles, timeframe = '5m') {
  if (!baseCandles || baseCandles.length === 0) return [];
  if (timeframe === '5m') return baseCandles;

  const aggregated = [];

  if (timeframe === '1D') {
    // Group by dateStr
    const groups = new Map();
    for (const c of baseCandles) {
      if (!groups.has(c.dateStr)) {
        groups.set(c.dateStr, []);
      }
      groups.get(c.dateStr).push(c);
    }

    for (const [, group] of groups) {
      if (group.length === 0) continue;
      const first = group[0];
      const last = group[group.length - 1];

      let high = -Infinity;
      let low = Infinity;
      let volume = 0;

      for (const item of group) {
        if (item.high > high) high = item.high;
        if (item.low < low) low = item.low;
        volume += item.volume;
      }

      aggregated.push({
        time: first.time,
        displayTime: first.dateStr,
        dateStr: first.dateStr,
        timeStr: 'Day Close',
        open: first.open,
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: last.close,
        volume,
        phase: last.phase,
        tip: last.tip,
      });
    }

    return aggregated;
  }

  // Bucket size in number of 5-minute candles
  const bucketSize = timeframe === '15m' ? 3 : timeframe === '1h' ? 12 : 1;

  for (let i = 0; i < baseCandles.length; i += bucketSize) {
    const chunk = baseCandles.slice(i, i + bucketSize);
    if (chunk.length === 0) continue;

    const first = chunk[0];
    const last = chunk[chunk.length - 1];

    let high = -Infinity;
    let low = Infinity;
    let volume = 0;

    for (const item of chunk) {
      if (item.high > high) high = item.high;
      if (item.low < low) low = item.low;
      volume += item.volume;
    }

    aggregated.push({
      time: first.time,
      displayTime: first.displayTime,
      dateStr: first.dateStr,
      timeStr: first.timeStr,
      open: first.open,
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: last.close,
      volume,
      phase: last.phase,
      tip: last.tip,
    });
  }

  return aggregated;
}

