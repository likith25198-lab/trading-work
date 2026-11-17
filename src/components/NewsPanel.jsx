import React, { useState } from 'react';
import { Newspaper, Globe, Building2, TrendingUp, TrendingDown, ArrowRight, Lightbulb } from 'lucide-react';

export default function NewsPanel({
  visibleNews,
  selectedSymbol,
  currentDay = 1,
  onSelectStock,
  stockList = [],
}) {
  const [filterType, setFilterType] = useState('all'); // 'all' | 'macro' | 'sector'
  const [stockFilter, setStockFilter] = useState('all');

  const filterSymbols = [
    'all',
    ...(stockList.length > 0
      ? stockList.map((s) => s.symbol)
      : ['RELIANCE', 'TCS', 'TATAMOTORS', 'HDFCBANK', 'INFY', 'WIPRO', 'ICICIBANK', 'ITC', 'SBIN', 'BHARTIARTL', 'LT']),
  ];

  const filteredNews = visibleNews.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (stockFilter !== 'all') {
      const touchesStock = item.impactedStocks.some((s) => s.symbol === stockFilter);
      if (!touchesStock) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Filters Header */}
      <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'all', label: 'All News' },
            { id: 'macro', label: 'Macro Economy' },
            { id: 'sector', label: 'Sector News' },
          ].map((f) => (
            <button
              key={f.id}
              className={`toolbar-btn ${filterType === f.id ? 'active' : ''}`}
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => setFilterType(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5 }}>
            Filter:
          </span>
          {filterSymbols.map((sym) => (
            <button
              key={sym}
              className={`toolbar-btn ${stockFilter === sym ? 'active' : ''}`}
              style={{ fontSize: 10, padding: '2px 6px' }}
              onClick={() => setStockFilter(sym)}
            >
              {sym === 'all' ? 'All' : sym}
            </button>
          ))}
        </div>
      </div>

      {filteredNews.length === 0 ? (
        <div className="empty-state">
          <Newspaper size={32} />
          {currentDay <= 1 ? (
            <div style={{ maxWidth: 280, margin: '0 auto', textAlign: 'center' }}>
              <strong style={{ color: '#60a5fa', display: 'block', marginBottom: 6, fontSize: 13 }}>
                Day 1: Pure Technical Analysis
              </strong>
              <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                Zero news in Day 1! We are starting easy: prices move purely based on technical indicators (SMA, VWAP, RSI) and support/resistance bounces. Breaking news catalysts will start arriving in Day 2!
              </p>
            </div>
          ) : (
            <p>No market news for the selected filter yet. Play the simulation to unlock breaking news!</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredNews.map((news) => {
            const hasCurrentStock = news.impactedStocks.some(
              (s) => s.symbol === selectedSymbol
            );

            return (
              <div
                key={news.id}
                style={{
                  background: '#151c2c',
                  border: hasCurrentStock ? '1px solid #3b82f6' : '1px solid #2a3550',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Meta Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {news.type === 'macro' ? (
                      <Globe size={13} color="#a78bfa" />
                    ) : (
                      <Building2 size={13} color="#38bdf8" />
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: news.type === 'macro' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        color: news.type === 'macro' ? '#c084fc' : '#38bdf8',
                      }}
                    >
                      {news.category}
                    </span>
                  </div>

                  <span style={{ fontSize: 10, color: '#64748b' }}>
                    Simulation Event
                  </span>
                </div>

                {/* Headline */}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.35 }}>
                  {news.headline}
                </div>

                {/* Summary */}
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                  {news.summary}
                </div>

                {/* Impacted Stocks Pill Row */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: '#1a2035',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#cbd5e1' }}>
                    Stock Price &amp; Valuation Impact:
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {news.impactedStocks.map((item) => {
                      const isBullish = item.direction === 'BULLISH';
                      const isBearish = item.direction === 'BEARISH';
                      const isSelected = item.symbol === selectedSymbol;

                      return (
                        <div
                          key={item.symbol}
                          onClick={() => onSelectStock(item.symbol)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(59, 130, 246, 0.22)' : '#0f1624',
                            border: isSelected
                              ? '1px solid #3b82f6'
                              : isBullish
                                ? '1px solid rgba(16, 185, 129, 0.35)'
                                : isBearish
                                  ? '1px solid rgba(239, 68, 68, 0.35)'
                                  : '1px solid #2a3550',
                            transition: 'all 0.12s',
                          }}
                          title={`Click to view ${item.symbol} chart`}
                        >
                          {isBullish ? (
                            <TrendingUp size={12} color="#10b981" />
                          ) : isBearish ? (
                            <TrendingDown size={12} color="#ef4444" />
                          ) : null}
                          <strong style={{ color: '#fff' }}>{item.symbol}</strong>
                          <span
                            style={{
                              fontSize: 10,
                              color: isBullish ? '#34d399' : isBearish ? '#f87171' : '#94a3b8',
                            }}
                          >
                            {item.effect}
                          </span>
                          <ArrowRight size={10} color="#64748b" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Workshop Teaching Takeaway */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    padding: '6px 8px',
                    borderRadius: 4,
                    background: 'rgba(245, 158, 11, 0.08)',
                    borderLeft: '3px solid #f59e0b',
                    fontSize: 11,
                    color: '#e2e8f0',
                    lineHeight: 1.4,
                  }}
                >
                  <Lightbulb size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ color: '#fbbf24' }}>Workshop Takeaway: </strong>
                    {news.workshopTakeaway}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

