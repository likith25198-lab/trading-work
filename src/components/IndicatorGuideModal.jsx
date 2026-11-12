import React from 'react';
import { X, BookOpen } from 'lucide-react';

const INDICATOR_DOCS = [
  {
    name: 'SMA 20 & SMA 50 (Simple Moving Average)',
    category: 'Trend Overlay',
    color: '#3b82f6',
    what: 'Average closing price over the last 20 or 50 candles. Smooths out noise to show trend direction.',
    howToRead:
      'When price stays above SMA 20, short-term trend is bullish. When SMA 20 crosses ABOVE SMA 50 ("Golden Cross"), buyers have momentum; crossing BELOW ("Death Cross") signals weakness.',
  },
  {
    name: 'EMA 12 & EMA 26 (Exponential Moving Average)',
    category: 'Trend Overlay',
    color: '#06b6d4',
    what: 'Gives extra weight to the most recent prices, reacting faster than SMA to sudden moves.',
    howToRead:
      'Active traders watch EMA 12 crossing EMA 26 for early entry/exit signals before slower SMAs react.',
  },
  {
    name: 'Bollinger Bands (20, 2)',
    category: 'Volatility Overlay',
    color: '#a78bfa',
    what: 'An upper and lower band plotted 2 standard deviations away from the 20-period SMA.',
    howToRead:
      'When bands narrow ("Squeeze"), a big breakout is often coming. Price touching the upper band shows strength/overextension; lower band can act as dynamic support.',
  },
  {
    name: 'VWAP (Volume Weighted Average Price)',
    category: 'Intraday Benchmark',
    color: '#ec4899',
    what: 'The average price weighted by trading volume for the current session.',
    howToRead:
      'Institutional benchmark: price above VWAP indicates buyers control the session; below VWAP indicates sellers control.',
  },
  {
    name: 'RSI (Relative Strength Index - 14)',
    category: 'Momentum Oscillator',
    color: '#f59e0b',
    what: 'Measures speed and magnitude of recent gains vs losses on a 0–100 scale.',
    howToRead:
      'Above 70 = Overbought (risk of pullback). Below 30 = Oversold (potential bounce). Crossing 50 confirms momentum shift.',
  },
  {
    name: 'MACD (12, 26, 9)',
    category: 'Trend & Momentum',
    color: '#10b981',
    what: 'Difference between EMA 12 and EMA 26 (MACD line), paired with a 9-period Signal line and Histogram.',
    howToRead:
      'Bullish when MACD crosses above Signal line and histogram turns green. Bearish when MACD crosses below Signal.',
  },
  {
    name: 'Stochastic Oscillator (14, 3)',
    category: 'Momentum Oscillator',
    color: '#38bdf8',
    what: 'Compares the closing price to its high-low range over 14 candles.',
    howToRead:
      'Above 80 = Overbought, Below 20 = Oversold. Look for %K crossing %D inside extreme zones.',
  },
  {
    name: 'Pivot Support & Resistance (S1 / R1)',
    category: 'Key Price Levels',
    color: '#94a3b8',
    what: 'Calculated price floors (Support) and ceilings (Resistance) from prior candle action.',
    howToRead:
      'Traders look for bounces near Support (S1) and profit-taking or breakouts at Resistance (R1).',
  },
];

export default function IndicatorGuideModal({ onClose, signals }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.78)',
        backdropFilter: 'blur(4px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#151c2c',
          border: '1px solid #2a3550',
          borderRadius: 12,
          width: 'min(860px, 95vw)',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.65)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #2a3550',
            background: '#111827',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={20} color="#3b82f6" />
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
                Technical Analysis Cheat Sheet
              </h2>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>
                How to read indicators and spot setups in real time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#1a2035',
              border: '1px solid #2a3550',
              color: '#94a3b8',
              borderRadius: 6,
              padding: 6,
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {signals && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
              padding: '12px 20px',
              background: '#0f1624',
              borderBottom: '1px solid #2a3550',
            }}
          >
            <div className="portfolio-card">
              <div className="portfolio-card-label">Trend (SMA 20/50)</div>
              <div
                className="portfolio-card-value"
                style={{
                  fontSize: 13,
                  color: signals.trend === 'Bullish' ? '#10b981' : '#ef4444',
                }}
              >
                {signals.trend}
              </div>
            </div>
            <div className="portfolio-card">
              <div className="portfolio-card-label">RSI (14)</div>
              <div
                className="portfolio-card-value"
                style={{
                  fontSize: 13,
                  color:
                    signals.rsi >= 70 ? '#ef4444' : signals.rsi <= 30 ? '#10b981' : '#e2e8f0',
                }}
              >
                {signals.rsi !== null ? `${signals.rsi} (${signals.rsiLabel})` : '—'}
              </div>
            </div>
            <div className="portfolio-card">
              <div className="portfolio-card-label">MACD Signal</div>
              <div
                className="portfolio-card-value"
                style={{
                  fontSize: 13,
                  color: signals.macdLabel === 'Bullish' ? '#10b981' : '#ef4444',
                }}
              >
                {signals.macdLabel}
              </div>
            </div>
            <div className="portfolio-card">
              <div className="portfolio-card-label">Price vs VWAP</div>
              <div
                className="portfolio-card-value"
                style={{
                  fontSize: 13,
                  color: signals.aboveVwap ? '#10b981' : '#ef4444',
                }}
              >
                {signals.aboveVwap ? 'Above VWAP' : 'Below VWAP'}
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            padding: 20,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 12,
          }}
        >
          {INDICATOR_DOCS.map((doc) => (
            <div
              key={doc.name}
              style={{
                background: '#111827',
                border: '1px solid #2a3550',
                borderLeft: `3px solid ${doc.color}`,
                borderRadius: 8,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>
                  {doc.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: '#1a2035',
                    color: doc.color,
                    fontWeight: 600,
                  }}
                >
                  {doc.category}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, lineHeight: 1.45 }}>
                <strong style={{ color: '#cbd5e1' }}>What it is:</strong> {doc.what}
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
                <strong style={{ color: '#cbd5e1' }}>Workshop Tip:</strong> {doc.howToRead}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
