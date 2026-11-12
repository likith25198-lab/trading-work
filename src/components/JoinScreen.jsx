import React, { useState } from 'react';
import { TrendingUp, BarChart3, Zap, Users, ShieldCheck } from 'lucide-react';

export default function JoinScreen({ onJoin }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('WORKSHOP-101');
  const [startingCash, setStartingCash] = useState(1000000);
  const [role, setRole] = useState('participant');
  const [moderatorPassword, setModeratorPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    if (role === 'instructor') {
      if (moderatorPassword !== '0000') {
        setPasswordError('Incorrect password. Please enter the moderator PIN.');
        return;
      }
    }

    onJoin({
      name: trimmed,
      roomCode: roomCode.trim().toUpperCase() || 'WORKSHOP-101',
      startingCash: Number(startingCash),
      role,
      moderatorPassword,
    });
  };

  return (
    <div className="login-screen">
      <div className="login-card" style={{ width: 470 }}>
        <div className="login-logo">
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 10px 25px rgba(59, 130, 246, 0.35)',
            }}
          >
            <TrendingUp size={30} />
          </div>
          <h1>TradeLab Workshop</h1>
          <p>Pre-programmed Live Stock Market &amp; Technical Analysis Simulator</p>
          <span
            style={{
              display: 'inline-block',
              marginTop: 10,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 999,
              background: 'rgba(245, 158, 11, 0.14)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
            }}
          >
            Educational Sandbox • Virtual Money Only
          </span>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="trade-input-group">
            <label className="trade-label">Your Name</label>
            <input
              type="text"
              className="login-input"
              placeholder="e.g., Aarav Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="trade-input-group">
              <label className="trade-label">Session Code</label>
              <input
                type="text"
                className="login-input"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />
            </div>

            <div className="trade-input-group">
              <label className="trade-label">Starting Capital</label>
              <select
                className="login-input"
                value={startingCash}
                onChange={(e) => setStartingCash(Number(e.target.value))}
              >
                <option value={500000}>₹5,00,000</option>
                <option value={1000000}>₹10,00,000</option>
                <option value={2500000}>₹25,00,000</option>
              </select>
            </div>
          </div>

          <div className="trade-input-group">
            <label className="trade-label">Mode</label>
            <div className="trade-type-toggle">
              <button
                type="button"
                className={`trade-type-btn ${role === 'participant' ? 'buy active' : ''}`}
                style={
                  role === 'participant'
                    ? { background: '#3b82f6', color: '#fff' }
                    : undefined
                }
                onClick={() => {
                  setRole('participant');
                  setPasswordError('');
                }}
              >
                Participant
              </button>
              <button
                type="button"
                className={`trade-type-btn ${role === 'instructor' ? 'buy active' : ''}`}
                style={
                  role === 'instructor'
                    ? { background: '#8b5cf6', color: '#fff' }
                    : undefined
                }
                onClick={() => {
                  setRole('instructor');
                  setPasswordError('');
                }}
              >
                Moderator / Instructor
              </button>
            </div>
          </div>

          {role === 'instructor' && (
            <div className="trade-input-group" style={{ marginTop: 2 }}>
              <label className="trade-label">Moderator Password</label>
              <input
                type="password"
                className="login-input"
                placeholder="Enter Moderator PIN"
                maxLength={10}
                value={moderatorPassword}
                onChange={(e) => {
                  setModeratorPassword(e.target.value);
                  if (passwordError) setPasswordError('');
                }}
                autoFocus
                required
              />
              {passwordError && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>
                  {passwordError}
                </div>
              )}
            </div>
          )}

          <button type="submit" className="login-btn">
            Join Workshop Terminal
          </button>
        </form>

        <div className="login-features">
          <div className="login-feature">
            <div
              className="login-feature-icon"
              style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}
            >
              <Zap size={15} />
            </div>
            <span>5m, 15m, 1h &amp; 1D Timeframes</span>
          </div>
          <div className="login-feature">
            <div
              className="login-feature-icon"
              style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
            >
              <BarChart3 size={15} />
            </div>
            <span>Study Mode &amp; Chart Drawings</span>
          </div>
          <div className="login-feature">
            <div
              className="login-feature-icon"
              style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}
            >
              <Users size={15} />
            </div>
            <span>Live workshop leaderboard</span>
          </div>
          <div className="login-feature">
            <div
              className="login-feature-icon"
              style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}
            >
              <ShieldCheck size={15} />
            </div>
            <span>Zero real-money risk</span>
          </div>
        </div>
      </div>
    </div>
  );
}

