import React, { useState } from 'react';
import { formatCurrency } from '../utils/formatters';

export default function TradePanel({
  stock,
  currentPrice,
  cash,
  holding,
  signals,
  onExecuteOrder,
}) {
  const [orderSide, setOrderSide] = useState('BUY');
  const [qty, setQty] = useState(10);

  const numericQty = Math.max(0, Math.floor(Number(qty) || 0));
  const orderValue = numericQty * currentPrice;
  const maxBuyQty = currentPrice > 0 ? Math.floor(cash / currentPrice) : 0;
  const ownedQty = holding?.qty || 0;

  const canExecute =
    numericQty > 0 &&
    (orderSide === 'BUY' ? orderValue <= cash : numericQty <= ownedQty);

  const handleQuickPct = (pct) => {
    if (orderSide === 'BUY') {
      setQty(Math.max(1, Math.floor(maxBuyQty * pct)));
    } else {
      setQty(Math.max(1, Math.floor(ownedQty * pct)));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canExecute) return;
    onExecuteOrder({
      symbol: stock.symbol,
      type: orderSide,
      qty: numericQty,
      price: currentPrice,
    });
  };

  const unrealizedPnl =
    holding && holding.qty > 0
      ? (currentPrice - holding.avgPrice) * holding.qty
      : 0;

  return (
    <div className="trade-form">
      <div className="trade-type-toggle">
        <button
          type="button"
          className={`trade-type-btn buy ${orderSide === 'BUY' ? 'active' : ''}`}
          onClick={() => setOrderSide('BUY')}
        >
          BUY
        </button>
        <button
          type="button"
          className={`trade-type-btn sell ${orderSide === 'SELL' ? 'active' : ''}`}
          onClick={() => setOrderSide('SELL')}
        >
          SELL
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="trade-input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="trade-label">Quantity (Shares)</label>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {orderSide === 'BUY' ? `Max: ${maxBuyQty}` : `Owned: ${ownedQty}`}
            </span>
          </div>
          <input
            type="number"
            min="1"
            step="1"
            className="trade-input"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
            {[
              { label: '25%', val: 0.25 },
              { label: '50%', val: 0.5 },
              { label: '75%', val: 0.75 },
              { label: 'MAX', val: 1 },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                className="toolbar-btn"
                style={{ fontSize: 11, padding: '4px 6px' }}
                onClick={() => handleQuickPct(btn.val)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="trade-summary">
          <div className="trade-summary-row">
            <span className="label">Market Price</span>
            <span className="value">{formatCurrency(currentPrice)}</span>
          </div>
          <div className="trade-summary-row">
            <span className="label">Estimated Total</span>
            <span className="value">{formatCurrency(orderValue)}</span>
          </div>
          <div className="trade-summary-row">
            <span className="label">Available Cash</span>
            <span className="value">{formatCurrency(cash)}</span>
          </div>
          {holding && holding.qty > 0 && (
            <div className="trade-summary-row">
              <span className="label">Open Position ({holding.qty} sh)</span>
              <span className={`value ${unrealizedPnl >= 0 ? 'positive' : 'negative'}`}>
                {unrealizedPnl >= 0 ? '+' : ''}
                {formatCurrency(unrealizedPnl)}
              </span>
            </div>
          )}
        </div>

        <button
          type="submit"
          className={`trade-execute-btn ${orderSide === 'BUY' ? 'buy' : 'sell'}`}
          disabled={!canExecute}
        >
          {orderSide === 'BUY'
            ? `Buy ${numericQty} ${stock.symbol}`
            : `Sell ${numericQty} ${stock.symbol}`}
        </button>

        {!canExecute && numericQty > 0 && (
          <div style={{ fontSize: 11, color: '#ef4444', textAlign: 'center' }}>
            {orderSide === 'BUY'
              ? 'Insufficient virtual cash for this quantity.'
              : `You only hold ${ownedQty} shares of ${stock.symbol}.`}
          </div>
        )}
      </form>

      {signals && (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            background: '#1a2035',
            borderRadius: 8,
            border: '1px solid #2a3550',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#94a3b8',
              marginBottom: 8,
            }}
          >
            Live Technical Signals ({stock.symbol})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <div className="trade-summary-row">
              <span className="label">SMA 20 vs 50</span>
              <span
                className={`value ${signals.trend === 'Bullish' ? 'positive' : 'negative'}`}
              >
                {signals.trend}
              </span>
            </div>
            <div className="trade-summary-row">
              <span className="label">RSI (14)</span>
              <span
                className="value"
                style={{
                  color:
                    signals.rsi >= 70
                      ? '#ef4444'
                      : signals.rsi <= 30
                      ? '#10b981'
                      : '#e2e8f0',
                }}
              >
                {signals.rsi !== null ? `${signals.rsi} • ${signals.rsiLabel}` : 'Warming up'}
              </span>
            </div>
            <div className="trade-summary-row">
              <span className="label">MACD</span>
              <span
                className={`value ${signals.macdLabel === 'Bullish' ? 'positive' : 'negative'}`}
              >
                {signals.macdLabel}
              </span>
            </div>
            <div className="trade-summary-row">
              <span className="label">Price vs VWAP</span>
              <span className={`value ${signals.aboveVwap ? 'positive' : 'negative'}`}>
                {signals.aboveVwap ? 'Above (Bullish)' : 'Below (Bearish)'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

