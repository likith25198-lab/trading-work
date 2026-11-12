import React from 'react';
import { Trophy, Wifi, WifiOff, Award } from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/formatters';

export default function LeaderboardPanel({
  clientId,
  participantName,
  roomCode,
  totalEquity,
  startingCash,
  ordersCount,
  liveLeaderboard,
  wsConnected,
  participantCount,
  competitionEnded,
}) {
  const selfReturnPct =
    startingCash > 0 ? ((totalEquity - startingCash) / startingCash) * 100 : 0;

  // Use live server leaderboard when connected; fall back to self-only if offline
  const entries =
    wsConnected && liveLeaderboard.length > 0
      ? liveLeaderboard
      : [
          {
            id: clientId || 'self',
            name: participantName,
            equity: totalEquity,
            returnPct: selfReturnPct,
            trades: ordersCount,
          },
        ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          padding: '8px 10px',
          background: '#1a2035',
          borderRadius: 6,
          fontSize: 11,
          color: '#94a3b8',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trophy size={14} color="#fbbf24" />
          Room: <strong style={{ color: '#e2e8f0' }}>{roomCode}</strong>
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: wsConnected ? '#10b981' : '#f59e0b',
            fontWeight: 600,
          }}
        >
          {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {wsConnected ? `${participantCount} Live` : 'Offline'}
        </span>
      </div>

      {competitionEnded && entries.length > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.16), rgba(59, 130, 246, 0.12))',
            border: '1px solid rgba(251, 191, 36, 0.45)',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <Award size={22} color="#fbbf24" />
          </div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#fbbf24', fontWeight: 700 }}>
            Competition Winner
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 2 }}>
            {entries[0].name}
          </div>
          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
            {formatCurrency(entries[0].equity)} ({formatPercent(entries[0].returnPct)})
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="empty-state">
          <Trophy size={32} />
          <p>Waiting for participants to join {roomCode}...</p>
        </div>
      ) : (
        entries.map((entry, idx) => {
          const isSelf = entry.id === clientId;
          const rankClass =
            idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';

          return (
            <div
              key={entry.id}
              className="leaderboard-item"
              style={
                isSelf
                  ? { border: '1px solid #3b82f6', background: 'rgba(59, 130, 246, 0.12)' }
                  : undefined
              }
            >
              <div
                className={`leaderboard-rank ${rankClass}`}
                style={!rankClass ? { background: '#2a3550', color: '#94a3b8' } : undefined}
              >
                {idx + 1}
              </div>
              <div className="leaderboard-info">
                <div className="leaderboard-name">
                  {entry.name} {isSelf && <span style={{ color: '#60a5fa' }}>(You)</span>}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  {entry.trades} {entry.trades === 1 ? 'trade' : 'trades'}
                </div>
              </div>
              <div className="leaderboard-value">
                <div className="leaderboard-total">{formatCurrency(entry.equity)}</div>
                <div
                  className={`leaderboard-pnl ${
                    entry.returnPct >= 0 ? 'positive' : 'negative'
                  }`}
                >
                  {formatPercent(entry.returnPct)}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
