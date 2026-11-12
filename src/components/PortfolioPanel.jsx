import React from 'react';
import { Briefcase } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/formatters';

export default function PortfolioPanel({
  cash,
  startingCash,
  holdings,
  currentPrices,
  realizedPnl,
  onSelectStock,
}) {
  const holdingsEntries = Object.entries(holdings).filter(([, h]) => h.qty > 0);

  let holdingsValue = 0;
  let unrealizedPnl = 0;

  for (const [symbol, h] of holdingsEntries) {
    const price = currentPrices[symbol] || h.avgPrice;
    holdingsValue += price * h.qty;
    unrealizedPnl += (price - h.avgPrice) * h.qty;
  }

  const totalEquity = cash + holdingsValue;
  const totalPnl = totalEquity - startingCash;
  const totalReturnPct = startingCash > 0 ? (totalPnl / startingCash) * 100 : 0;

  return (
    <div>
      <div className="portfolio-summary">
        <div className="portfolio-card">
          <div className="portfolio-card-label">Net Worth</div>
          <div className="portfolio-card-value" style={{ fontSize: 14 }}>
            {formatCurrency(totalEquity)}
          </div>
        </div>
        <div className="portfolio-card">
          <div className="portfolio-card-label">Total Return</div>
          <div
            className={`portfolio-card-value ${totalPnl >= 0 ? 'positive' : 'negative'}`}
            style={{ fontSize: 14 }}
          >
            {formatPercent(totalReturnPct)}
          </div>
        </div>
        <div className="portfolio-card">
          <div className="portfolio-card-label">Unrealized P&amp;L</div>
          <div
            className={`portfolio-card-value ${unrealizedPnl >= 0 ? 'positive' : 'negative'}`}
            style={{ fontSize: 13 }}
          >
            {unrealizedPnl >= 0 ? '+' : ''}
            {formatCurrency(unrealizedPnl)}
          </div>
        </div>
        <div className="portfolio-card">
          <div className="portfolio-card-label">Realized P&amp;L</div>
          <div
            className={`portfolio-card-value ${realizedPnl >= 0 ? 'positive' : 'negative'}`}
            style={{ fontSize: 13 }}
          >
            {realizedPnl >= 0 ? '+' : ''}
            {formatCurrency(realizedPnl)}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: '#64748b',
          marginBottom: 8,
        }}
      >
        Open Holdings ({holdingsEntries.length})
      </div>

      {holdingsEntries.length === 0 ? (
        <div className="empty-state">
          <Briefcase size={32} />
          <p>No active positions yet. Buy a stock from the Trade tab to get started!</p>
        </div>
      ) : (
        <div className="holdings-list">
          {holdingsEntries.map(([symbol, h]) => {
            const cur = currentPrices[symbol] || h.avgPrice;
            const pnl = (cur - h.avgPrice) * h.qty;
            const pnlPct = ((cur - h.avgPrice) / h.avgPrice) * 100;
            return (
              <div
                key={symbol}
                className="holding-item"
                onClick={() => onSelectStock(symbol)}
              >
                <div className="holding-header">
                  <span className="holding-symbol">{symbol}</span>
                  <span className={`holding-pnl ${pnl >= 0 ? 'positive' : 'negative'}`}>
                    {pnl >= 0 ? '+' : ''}
                    {formatCurrency(pnl)} ({formatPercent(pnlPct)})
                  </span>
                </div>
                <div className="holding-details">
                  <span>
                    {h.qty} sh @ ₹{h.avgPrice.toFixed(2)}
                  </span>
                  <span>LTP: ₹{cur.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

