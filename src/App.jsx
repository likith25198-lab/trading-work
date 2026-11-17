import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  BookOpen,
  TrendingUp,
  LogOut,
  Lightbulb,
  History,
  FastForward,
  Trophy,
  Wifi,
  WifiOff,
  Flag,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import './App.css';
import {
  STOCKS,
  STOCK_LIST,
  SIM_INITIAL_CANDLES,
  WORKSHOP_JUMP_POINTS,
  WORKSHOP_NEWS_EVENTS,
} from './data/stockData';
import {
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateVWAP,
} from './utils/indicators';
import { formatCurrency, formatPercent } from './utils/formatters';
import { TIMEFRAMES, aggregateCandles } from './utils/timeframes';
import { WORKSHOP_PHASES, getPhaseForCandle } from './data/workshopPhases';
import JoinScreen from './components/JoinScreen';
import TradingChart from './components/TradingChart';
import TradePanel from './components/TradePanel';
import PortfolioPanel from './components/PortfolioPanel';
import LeaderboardPanel from './components/LeaderboardPanel';
import NewsPanel from './components/NewsPanel';
import IndicatorGuideModal from './components/IndicatorGuideModal';

const SPEED_OPTIONS = [
  { label: '8x (2s - Smooth)', ms: 2000, mult: 8 },
  { label: '16x (1s - Fast)', ms: 1000, mult: 16 },
  { label: '4x (4s - Paced)', ms: 4000, mult: 4 },
  { label: '2x (8s - Slow)', ms: 8000, mult: 2 },
  { label: '1x (16s - Realtime 20m)', ms: 16000, mult: 1 },
  { label: '32x (0.5s - Turbo)', ms: 500, mult: 32 },
];

const OVERLAY_OPTIONS = [
  { id: 'SMA20', label: 'SMA 20' },
  { id: 'SMA50', label: 'SMA 50' },
  { id: 'EMA12', label: 'EMA 12' },
  { id: 'EMA26', label: 'EMA 26' },
  { id: 'BB', label: 'Bollinger' },
  { id: 'VWAP', label: 'VWAP' },
  { id: 'PIVOTS', label: 'S/R Pivots' },
];

const OSCILLATOR_OPTIONS = [
  { id: 'RSI', label: 'RSI' },
  { id: 'MACD', label: 'MACD' },
  { id: 'STOCH', label: 'Stoch' },
  { id: 'ATR', label: 'ATR' },
  { id: null, label: 'Hide' },
];

const STORAGE_SESSION_KEY = 'tradelab_session';
const STORAGE_PORTFOLIO_KEY = 'tradelab_portfolio';

function loadSavedSession() {
  try {
    const raw =
      sessionStorage.getItem(STORAGE_SESSION_KEY) ||
      localStorage.getItem(STORAGE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadSavedPortfolio() {
  try {
    const raw =
      sessionStorage.getItem(STORAGE_PORTFOLIO_KEY) ||
      localStorage.getItem(STORAGE_PORTFOLIO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [participant, setParticipant] = useState(() => loadSavedSession());
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');

  // Simulation playback state (synced from server when connected)
  const maxCandles = STOCKS.RELIANCE.data.length;
  const [simIndex, setSimIndex] = useState(SIM_INITIAL_CANDLES);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(2000);
  const [speedMultiplier, setSpeedMultiplier] = useState(8);
  const [isPhaseBreak, setIsPhaseBreak] = useState(false);
  const [phaseBreakDay, setPhaseBreakDay] = useState(null);
  const [dismissedPhaseBreakModal, setDismissedPhaseBreakModal] = useState(false);
  const [competitionEnded, setCompetitionEnded] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  // Technical analysis controls
  const [selectedTimeframe, setSelectedTimeframe] = useState('5m');
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState(['SMA20', 'SMA50']);
  const [activeOscillator, setActiveOscillator] = useState('RSI');
  const [showGuide, setShowGuide] = useState(false);
  const [showTips, setShowTips] = useState(true);

  // Portfolio & trading state (persisted across page refreshes)
  const [cash, setCash] = useState(() => {
    const initialSession = loadSavedSession();
    const saved = initialSession ? loadSavedPortfolio() : null;
    return saved?.cash ?? (initialSession?.startingCash || 1000000);
  });
  const [holdings, setHoldings] = useState(() => {
    const initialSession = loadSavedSession();
    const saved = initialSession ? loadSavedPortfolio() : null;
    return saved?.holdings ?? {};
  });
  const [orders, setOrders] = useState(() => {
    const initialSession = loadSavedSession();
    const saved = initialSession ? loadSavedPortfolio() : null;
    return saved?.orders ?? [];
  });
  const [realizedPnl, setRealizedPnl] = useState(() => {
    const initialSession = loadSavedSession();
    const saved = initialSession ? loadSavedPortfolio() : null;
    return saved?.realizedPnl ?? 0;
  });
  const [activeTab, setActiveTab] = useState('trade');

  // Notifications & WebSocket room state
  const [toasts, setToasts] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveLeaderboard, setLiveLeaderboard] = useState([]);
  const [participantCount, setParticipantCount] = useState(1);

  const wsRef = useRef(null);
  const [clientId] = useState(() => {
    try {
      let id = sessionStorage.getItem('tradelab_client_id');
      if (!id) {
        id = `trader-${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem('tradelab_client_id', id);
      }
      return id;
    } catch {
      return `trader-${Math.random().toString(36).slice(2, 10)}`;
    }
  });

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const [loginError, setLoginError] = useState('');

  const handleLogout = useCallback(() => {
    setIsPlaying(false);
    if (wsRef.current && wsRef.current.readyState === 1) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'LEAVE', clientId }));
      } catch {
        // ignore
      }
      wsRef.current.close();
    }
    try {
      sessionStorage.removeItem(STORAGE_SESSION_KEY);
      sessionStorage.removeItem(STORAGE_PORTFOLIO_KEY);
      sessionStorage.removeItem('tradelab_client_id');
      localStorage.removeItem(STORAGE_SESSION_KEY);
      localStorage.removeItem(STORAGE_PORTFOLIO_KEY);
      localStorage.removeItem('tradelab_client_id');
    } catch {
      // ignore
    }
    setParticipant(null);
    setLoginError('');
  }, [clientId]);

  // Join handler
  const handleJoin = (info) => {
    setLoginError('');
    try {
      sessionStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(info));
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(info));
      sessionStorage.removeItem(STORAGE_PORTFOLIO_KEY);
      localStorage.removeItem(STORAGE_PORTFOLIO_KEY);
    } catch {
      // ignore
    }
    setParticipant(info);
    setCash(info.startingCash);
    setHoldings({});
    setOrders([]);
    setRealizedPnl(0);
    setSimIndex(SIM_INITIAL_CANDLES);
    setIsPlaying(false);
    setIsPhaseBreak(false);
    setPhaseBreakDay(null);
    setDismissedPhaseBreakModal(false);
    setCompetitionEnded(false);
    setShowWinnerModal(false);
    setUnreadNewsCount(0);
    addToast(`Joined ${info.roomCode} as ${info.name}`, 'success');
  };

  // Workshop Phase logic & timer
  const currentPhase = useMemo(() => getPhaseForCandle(simIndex), [simIndex]);
  const candlesRemainingInDay = useMemo(() => {
    if (currentPhase.day < 1 || currentPhase.day > 4) return 0;
    return Math.max(0, currentPhase.endCandle - simIndex);
  }, [currentPhase, simIndex]);

  const secondsRemainingInDay = useMemo(() => {
    if (currentPhase.day < 1 || currentPhase.day > 4) return 0;
    return Math.max(0, Math.round((candlesRemainingInDay / 75) * 1200));
  }, [candlesRemainingInDay, currentPhase]);

  const formatPhaseTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // News state
  const [unreadNewsCount, setUnreadNewsCount] = useState(0);
  const lastReportedNewsIdRef = useRef(null);

  const visibleNews = useMemo(() => {
    return WORKSHOP_NEWS_EVENTS.filter((n) => n.candleIndex <= simIndex).reverse();
  }, [simIndex]);

  // Alert toast when new breaking news unlocks
  useEffect(() => {
    if (visibleNews.length === 0) return;
    const latest = visibleNews[0];
    if (latest && latest.id !== lastReportedNewsIdRef.current) {
      lastReportedNewsIdRef.current = latest.id;
      setUnreadNewsCount((c) => c + 1);
      addToast(`BREAKING: ${latest.headline.slice(0, 68)}...`, 'info');
    }
  }, [visibleNews, addToast]);

  // Visible candles for currently selected stock
  const currentStock = STOCKS[selectedSymbol];
  const visibleData = useMemo(
    () => currentStock.data.slice(0, simIndex + 1),
    [currentStock, simIndex]
  );

  // Aggregated candles based on active timeframe (5m, 15m, 1h, 1D)
  const chartCandles = useMemo(
    () => aggregateCandles(visibleData, selectedTimeframe),
    [visibleData, selectedTimeframe]
  );

  const latestCandle = visibleData[visibleData.length - 1];
  const currentPrice = latestCandle.close;

  // Day-specific open and price move (calculated separately for each day)
  const currentDayStartIdx = Math.max(0, Math.floor(simIndex / 75) * 75);
  const currentDayOpen = currentStock.data[currentDayStartIdx]?.open || latestCandle.open;
  const dayChangePct =
    currentDayOpen > 0
      ? ((currentPrice - currentDayOpen) / currentDayOpen) * 100
      : 0;
  const dayChangeAmount = currentPrice - currentDayOpen;

  // Map of current prices for all stocks
  const currentPrices = useMemo(() => {
    const map = {};
    for (const s of STOCK_LIST) {
      const idx = Math.min(simIndex, s.data.length - 1);
      map[s.symbol] = s.data[idx].close;
    }
    return map;
  }, [simIndex]);

  // Total equity calculation
  const totalEquity = useMemo(() => {
    let holdingsVal = 0;
    for (const [sym, h] of Object.entries(holdings)) {
      if (h.qty > 0) {
        holdingsVal += (currentPrices[sym] || h.avgPrice) * h.qty;
      }
    }
    return cash + holdingsVal;
  }, [cash, holdings, currentPrices]);

  const totalEquityRef = useRef(totalEquity);
  const ordersCountRef = useRef(orders.length);

  useEffect(() => {
    totalEquityRef.current = totalEquity;
    ordersCountRef.current = orders.length;
  }, [totalEquity, orders.length]);

  // Persist portfolio state to storage
  useEffect(() => {
    if (!participant) return;
    try {
      const data = JSON.stringify({ cash, holdings, orders, realizedPnl });
      sessionStorage.setItem(STORAGE_PORTFOLIO_KEY, data);
      localStorage.setItem(STORAGE_PORTFOLIO_KEY, data);
    } catch {
      // ignore
    }
  }, [participant, cash, holdings, orders, realizedPnl]);

  // Connect to shared WebSocket room server with auto-reconnect
  useEffect(() => {
    if (!participant) return;

    let isUnmounted = false;
    let reconnectTimer = null;

    const connect = () => {
      if (isUnmounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = `${protocol}//${window.location.host}/ws`;
      // Direct connect when developing on Vite port 5173 to bypass any proxy delays
      if (window.location.hostname === 'localhost' && window.location.port === '5173') {
        wsUrl = 'ws://localhost:4000/ws';
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) {
          ws.close();
          return;
        }
        setWsConnected(true);
        const eq = totalEquityRef.current;
        const ords = ordersCountRef.current;
        const returnPct =
          participant.startingCash > 0
            ? ((eq - participant.startingCash) / participant.startingCash) * 100
            : 0;

        ws.send(
          JSON.stringify({
            type: 'JOIN',
            clientId,
            name: participant.name,
            role: participant.role,
            moderatorPassword: participant.moderatorPassword,
            roomCode: participant.roomCode,
            startingCash: participant.startingCash,
            equity: eq,
            returnPct,
            trades: ords,
            maxCandles,
          })
        );
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'JOIN_ERROR') {
          try {
            sessionStorage.removeItem(STORAGE_SESSION_KEY);
            sessionStorage.removeItem(STORAGE_PORTFOLIO_KEY);
            localStorage.removeItem(STORAGE_SESSION_KEY);
            localStorage.removeItem(STORAGE_PORTFOLIO_KEY);
          } catch {
            // ignore
          }
          setParticipant(null);
          setLoginError(msg.message || 'Access denied');
          addToast(msg.message || 'Access denied', 'error');
          return;
        }

        if (msg.type === 'ROOM_STATE') {
          setSimIndex(msg.simIndex);
          setIsPlaying(msg.isPlaying);
          setSpeedMs(msg.speedMs);
          if (msg.speedMultiplier) setSpeedMultiplier(msg.speedMultiplier);
          setIsPhaseBreak((prev) => {
            if (msg.isPhaseBreak && !prev) {
              setDismissedPhaseBreakModal(false);
            }
            return Boolean(msg.isPhaseBreak);
          });
          setPhaseBreakDay(msg.phaseBreakDay || null);
          setParticipantCount(msg.participantCount);
          setLiveLeaderboard(msg.leaderboard || []);
          setCompetitionEnded((prevEnded) => {
            if (msg.competitionEnded && !prevEnded) {
              setShowWinnerModal(true);
            }
            if (!msg.competitionEnded) {
              setShowWinnerModal(false);
            }
            return Boolean(msg.competitionEnded);
          });
          if (msg.notice) {
            addToast(msg.notice, 'info');
          }
        } else if (msg.type === 'TICK') {
          setSimIndex(msg.simIndex);
          setIsPlaying(msg.isPlaying);
        } else if (msg.type === 'LEADERBOARD_UPDATE') {
          setLiveLeaderboard(msg.leaderboard || []);
          if (msg.participantCount) setParticipantCount(msg.participantCount);
        } else if (msg.type === 'ROOM_RESET') {
          try {
            sessionStorage.removeItem(STORAGE_PORTFOLIO_KEY);
            localStorage.removeItem(STORAGE_PORTFOLIO_KEY);
          } catch {
            // ignore
          }
          setCash(participant.startingCash);
          setHoldings({});
          setOrders([]);
          setRealizedPnl(0);
          setIsPhaseBreak(false);
          setPhaseBreakDay(null);
          setDismissedPhaseBreakModal(false);
          setCompetitionEnded(false);
          setShowWinnerModal(false);
          addToast('Competition reset by moderator — fresh round started!', 'info');
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connect, 1500);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
    };
  }, [participant, clientId, maxCandles, addToast]);

  // Send live portfolio updates to room server whenever equity or trades change
  useEffect(() => {
    if (!participant || !wsConnected || !wsRef.current) return;
    if (wsRef.current.readyState !== 1) return;

    const returnPct =
      participant.startingCash > 0
        ? ((totalEquity - participant.startingCash) / participant.startingCash) * 100
        : 0;

    wsRef.current.send(
      JSON.stringify({
        type: 'PORTFOLIO_UPDATE',
        equity: totalEquity,
        returnPct,
        trades: orders.length,
      })
    );
  }, [participant, wsConnected, totalEquity, orders.length]);

  // Fallback local ticker ONLY if WebSocket server is offline
  useEffect(() => {
    if (!participant || wsConnected || !isPlaying) return;

    const timer = setInterval(() => {
      setSimIndex((prev) => {
        if (prev >= maxCandles - 1) {
          setIsPlaying(false);
          return prev;
        }
        const next = prev + 1;
        if (next >= maxCandles - 1) {
          setIsPlaying(false);
        }
        return next;
      });
    }, speedMs);

    return () => clearInterval(timer);
  }, [participant, wsConnected, isPlaying, speedMs, maxCandles]);

  // Instructor control helper (sends to server when connected, or local fallback)
  const sendControl = (action, extra = {}) => {
    // Optimistic UI response for play/pause to eliminate any perceived click lag
    if (action === 'PLAY') {
      setIsPlaying(true);
    } else if (action === 'PAUSE') {
      setIsPlaying(false);
    }

    if (wsConnected && wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(
        JSON.stringify({
          type: 'INSTRUCTOR_CONTROL',
          action,
          ...extra,
        })
      );
      return;
    }

    // Local fallback
    if (action === 'PLAY') {
      if (isPhaseBreak) {
        setIsPhaseBreak(false);
        setPhaseBreakDay(null);
        setSimIndex((i) => i + 1);
      } else {
        setSimIndex((i) => Math.min(maxCandles - 1, i + 1));
      }
      setIsPlaying(true);
    } else if (action === 'START_NEXT_PHASE') {
      setIsPhaseBreak(false);
      setPhaseBreakDay(null);
      setSimIndex((i) => {
        if (i === 449) return 450;
        if (i === 524) return 525;
        if (i === 599) return 600;
        return i + 1;
      });
      setIsPlaying(true);
    } else if (action === 'PAUSE') setIsPlaying(false);
    else if (action === 'STEP') {
      setIsPlaying(false);
      setSimIndex((i) => Math.min(maxCandles - 1, i + (extra.step || 1)));
    } else if (action === 'SET_SPEED') {
      if (extra.speedMs) setSpeedMs(extra.speedMs);
      if (extra.multiplier) setSpeedMultiplier(extra.multiplier);
    } else if (action === 'JUMP') {
      setSimIndex(Math.min(maxCandles - 1, Math.max(SIM_INITIAL_CANDLES, extra.index)));
      setIsPhaseBreak(false);
      setPhaseBreakDay(null);
      addToast(`Jumped to: ${extra.label}`, 'info');
    } else if (action === 'END_COMPETITION') {
      setIsPlaying(false);
      setCompetitionEnded(true);
      setShowWinnerModal(true);
    } else if (action === 'RESET_ROOM') {
      setIsPlaying(false);
      setSimIndex(SIM_INITIAL_CANDLES);
      setIsPhaseBreak(false);
      setPhaseBreakDay(null);
      setDismissedPhaseBreakModal(false);
      setCash(participant.startingCash);
      setHoldings({});
      setOrders([]);
      setRealizedPnl(0);
      setCompetitionEnded(false);
      setShowWinnerModal(false);
      addToast('Simulation reset to session start', 'info');
    }
  };

  // Live technical analysis summary for selected stock
  const liveSignals = useMemo(() => {
    if (visibleData.length < 30) return null;
    const sma20 = calculateSMA(visibleData, 20);
    const sma50 = calculateSMA(visibleData, 50);
    const rsi = calculateRSI(visibleData, 14);
    const macd = calculateMACD(visibleData, 12, 26, 9);
    const vwap = calculateVWAP(visibleData);

    const last = visibleData.length - 1;
    const s20 = sma20[last];
    const s50 = sma50[last];
    const r = rsi[last];
    const mLine = macd.macdLine[last];
    const sLine = macd.signalLine[last];
    const v = vwap[last];

    let rsiLabel = 'Neutral';
    if (r !== null) {
      if (r >= 70) rsiLabel = 'Overbought';
      else if (r <= 30) rsiLabel = 'Oversold';
    }

    return {
      trend: s20 && s50 ? (s20 >= s50 ? 'Bullish' : 'Bearish') : 'Neutral',
      rsi: r,
      rsiLabel,
      macdLabel:
        mLine !== null && sLine !== null ? (mLine >= sLine ? 'Bullish' : 'Bearish') : 'Neutral',
      aboveVwap: v !== null ? currentPrice >= v : true,
    };
  }, [visibleData, currentPrice]);

  // Execute Buy / Sell order
  const handleExecuteOrder = ({ symbol, type, qty, price }) => {
    const totalCost = qty * price;
    const candle = STOCKS[symbol].data[simIndex];

    if (type === 'BUY') {
      if (totalCost > cash) {
        addToast('Insufficient cash for this order', 'error');
        return;
      }
      setCash((prev) => prev - totalCost);
      setHoldings((prev) => {
        const existing = prev[symbol] || { qty: 0, avgPrice: 0 };
        const newQty = existing.qty + qty;
        const newAvg = (existing.qty * existing.avgPrice + totalCost) / newQty;
        return {
          ...prev,
          [symbol]: { qty: newQty, avgPrice: newAvg },
        };
      });
      setOrders((prev) => [
        {
          id: Date.now() + Math.random(),
          symbol,
          type: 'BUY',
          qty,
          price,
          total: totalCost,
          candleTime: candle.time,
          displayTime: candle.displayTime,
          pnl: null,
        },
        ...prev,
      ]);
      addToast(`Bought ${qty} ${symbol} @ ₹${price.toFixed(2)}`, 'success');
    } else {
      const existing = holdings[symbol];
      if (!existing || existing.qty < qty) {
        addToast(`Not enough ${symbol} shares to sell`, 'error');
        return;
      }
      const tradePnl = (price - existing.avgPrice) * qty;
      setCash((prev) => prev + totalCost);
      setRealizedPnl((prev) => prev + tradePnl);
      setHoldings((prev) => {
        const remaining = existing.qty - qty;
        if (remaining <= 0) {
          const copy = { ...prev };
          delete copy[symbol];
          return copy;
        }
        return {
          ...prev,
          [symbol]: { qty: remaining, avgPrice: existing.avgPrice },
        };
      });
      setOrders((prev) => [
        {
          id: Date.now() + Math.random(),
          symbol,
          type: 'SELL',
          qty,
          price,
          total: totalCost,
          candleTime: candle.time,
          displayTime: candle.displayTime,
          pnl: tradePnl,
        },
        ...prev,
      ]);
      addToast(
        `Sold ${qty} ${symbol} @ ₹${price.toFixed(2)} (${
          tradePnl >= 0 ? '+' : ''
        }₹${tradePnl.toFixed(0)})`,
        tradePnl >= 0 ? 'success' : 'error'
      );
    }
  };

  const toggleOverlay = (id) => {
    setActiveOverlays((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (!participant) {
    return <JoinScreen onJoin={handleJoin} initialError={loginError} />;
  }

  const isInstructor = participant.role === 'instructor';
  const totalPnl = totalEquity - participant.startingCash;
  const totalReturnPct = (totalPnl / participant.startingCash) * 100;
  const winner = liveLeaderboard[0];

  return (
    <div className="app-container">
      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>

      {showGuide && (
        <IndicatorGuideModal onClose={() => setShowGuide(false)} signals={liveSignals} />
      )}

      {/* Competition Winner Modal */}
      {showWinnerModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 15, 0.8)',
            backdropFilter: 'blur(4px)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowWinnerModal(false)}
        >
          <div
            style={{
              background: '#151c2c',
              border: '1px solid #fbbf24',
              borderRadius: 14,
              padding: 28,
              width: 'min(440px, 92vw)',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0,0,0,0.65)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowWinnerModal(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>

            <div
              style={{
                width: 60,
                height: 60,
                margin: '0 auto 12px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ffd700, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000',
              }}
            >
              <Trophy size={30} />
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', letterSpacing: 1 }}>
              WORKSHOP COMPETITION RESULTS
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 6 }}>
              {winner ? `${winner.name} Wins!` : 'Competition Ended'}
            </h2>
            {winner && (
              <p style={{ fontSize: 15, color: '#10b981', fontWeight: 700, marginTop: 4 }}>
                {formatCurrency(winner.equity)} ({formatPercent(winner.returnPct)})
              </p>
            )}

            <div style={{ marginTop: 18, textAlign: 'left' }}>
              {liveLeaderboard.slice(0, 5).map((entry, idx) => (
                <div
                  key={entry.id}
                  className="leaderboard-item"
                  style={
                    entry.id === clientId
                      ? { border: '1px solid #3b82f6' }
                      : undefined
                  }
                >
                  <div
                    className={`leaderboard-rank ${
                      idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : ''
                    }`}
                    style={idx > 2 ? { background: '#2a3550', color: '#94a3b8' } : undefined}
                  >
                    {idx + 1}
                  </div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{entry.name}</div>
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
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Workshop Phase Break / Intermission Modal */}
      {isPhaseBreak && !dismissedPhaseBreakModal && (
        <div
          className="phase-modal-backdrop"
          onClick={() => setDismissedPhaseBreakModal(true)}
        >
          <div className="phase-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="phase-modal-close"
              onClick={() => setDismissedPhaseBreakModal(true)}
              title="Close & Study Chart"
            >
              <X size={18} />
            </button>

            <div className="phase-modal-header">
              <div className="phase-modal-badge">TRADING SESSION COMPLETED</div>
              <h2 className="phase-modal-title">
                Day {phaseBreakDay} Finished — Market Paused for Analysis
              </h2>
              <p className="phase-modal-sub">
                {phaseBreakDay === 1 &&
                  'Day 1 (Pure Technical Moves) is complete! In Day 2, breaking sector news and candlestick patterns (Hammers, Engulfings, Stars) will begin impacting stock prices.'}
                {phaseBreakDay === 2 &&
                  'Day 2 is complete! Review how breaking news interacted with candlestick patterns. In Day 3, macro commodity & inflation shocks will test portfolio risk.'}
                {phaseBreakDay === 3 &&
                  'Day 3 complete! We are now heading into Day 4: Grand Finale! Finalize your strategy and protect your capital before the closing bell.'}
              </p>
            </div>

            <div className="phase-modal-study-box">
              <h4>🎯 Recommended Analysis Before Day {Number(phaseBreakDay) + 1}</h4>
              <ul>
                <li>
                  <strong>Draw Trendlines & Support:</strong> Use the chart drawing
                  tools (trendline / horizontal lines) to mark support & resistance
                  levels formed in Day {phaseBreakDay}.
                </li>
                <li>
                  <strong>Higher Timeframes:</strong> Switch to <strong>15m</strong> and{' '}
                  <strong>1h</strong> candles to spot key horizontal consolidation
                  zones and multi-candle trends.
                </li>
                <li>
                  <strong>Indicators & Patterns:</strong> Check RSI swings, VWAP bounces,
                  and candlestick reversal badges on your watchlisted stocks.
                </li>
              </ul>
            </div>

            <div className="phase-modal-leaderboard">
              <h4>🏆 Current Competition Standings</h4>
              <div className="phase-modal-leaders">
                {liveLeaderboard.slice(0, 3).map((u, i) => (
                  <div key={u.id} className="phase-leader-row">
                    <span className={`leader-rank-badge rank-${i + 1}`}>#{i + 1}</span>
                    <span className="leader-name">{u.name}</span>
                    <span className={`leader-pnl ${u.returnPct >= 0 ? 'pos' : 'neg'}`}>
                      {formatPercent(u.returnPct)} ({formatCurrency(u.equity)})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="phase-modal-actions">
              {isInstructor ? (
                <div className="phase-instructor-bar">
                  <button
                    className="start-next-phase-btn"
                    onClick={() => {
                      setDismissedPhaseBreakModal(true);
                      sendControl('START_NEXT_PHASE');
                    }}
                  >
                    <Play size={16} />
                    Open Day {Number(phaseBreakDay) + 1} Trading Session
                  </button>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    (Or let participants continue analyzing charts and click when ready)
                  </span>
                </div>
              ) : (
                <div className="phase-participant-wait">
                  <div className="waiting-pill">
                    ⏳ Waiting for Moderator to open Day {Number(phaseBreakDay) + 1} trading session...
                  </div>
                  <button
                    className="study-charts-btn"
                    onClick={() => setDismissedPhaseBreakModal(true)}
                  >
                    Analyze Charts & Draw Levels Now →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <TrendingUp size={22} />
          <span>TradeLab</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
              background: '#1a2035',
              border: '1px solid #2a3550',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {wsConnected ? (
              <Wifi size={12} color="#10b981" />
            ) : (
              <WifiOff size={12} color="#f59e0b" />
            )}
            {participant.roomCode} • {participantCount} Live
          </span>
        </div>

        {/* Simulation Playback & Speed Controls */}
        <div className="header-center">
          <div className="sim-time">
            <span className="sim-date">{latestCandle.dateStr}</span>
            <span className="sim-clock">{latestCandle.timeStr}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              ({simIndex}/{maxCandles - 1})
            </span>
          </div>

          {isInstructor ? (
            <div className="toolbar-group">
              <button
                className={`toolbar-btn ${isPlaying ? 'red' : 'green'}`}
                onClick={() => sendControl(isPlaying ? 'PAUSE' : 'PLAY')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying ? 'Pause All' : 'Start / Play'}
              </button>

              <button
                className="toolbar-btn"
                title="Step +1 candle for everyone"
                onClick={() => sendControl('STEP', { step: 1 })}
              >
                <SkipForward size={14} />
              </button>

              <button
                className="toolbar-btn"
                title="Step +5 candles for everyone"
                onClick={() => sendControl('STEP', { step: 5 })}
              >
                <FastForward size={14} />
              </button>

              <div className="toolbar-separator" />

              <span className="speed-label" style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Speed:</span>
              <select
                className="toolbar-btn"
                value={speedMultiplier}
                onChange={(e) => {
                  const mult = Number(e.target.value);
                  const opt = SPEED_OPTIONS.find((o) => o.mult === mult) || SPEED_OPTIONS[0];
                  sendControl('SET_SPEED', { speedMs: opt.ms, multiplier: opt.mult });
                }}
                style={{
                  background: '#151c2c',
                  color: '#93c5fd',
                  borderColor: '#3b82f6',
                  fontWeight: 600,
                  fontSize: 12,
                  padding: '4px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                {SPEED_OPTIONS.map((opt) => (
                  <option key={opt.mult} value={opt.mult} style={{ background: '#0f172a', color: '#fff' }}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="toolbar-separator" />

              <button
                className="toolbar-btn"
                style={{ borderColor: '#f59e0b', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}
                title="End competition and announce winner on all screens"
                onClick={() => sendControl('END_COMPETITION')}
              >
                <Flag size={13} />
                Finish
              </button>

              <button
                className="toolbar-btn"
                title="Reset room & all participants for a new round"
                onClick={() => sendControl('RESET_ROOM')}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                background: '#1a2035',
                border: '1px solid #2a3550',
                fontSize: 12,
                color: isPlaying ? '#10b981' : '#f59e0b',
                fontWeight: 600,
              }}
            >
              {competitionEnded
                ? 'Competition Ended'
                : isPhaseBreak
                ? `Day ${phaseBreakDay} Analysis Break (Market Paused)`
                : isPlaying
                ? `${currentPhase.shortName} • ${formatPhaseTime(secondsRemainingInDay)} left`
                : 'Market Paused'}
            </div>
          )}
        </div>

        <div className="header-right">
          <button
            className="toolbar-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderColor: '#3b82f6',
              color: '#60a5fa',
            }}
            onClick={() => setShowGuide(true)}
          >
            <BookOpen size={14} />
            Indicator Guide
          </button>

          <div
            className="participant-badge"
            style={
              isInstructor
                ? {
                    borderColor: '#8b5cf6',
                    background: 'rgba(139, 92, 246, 0.12)',
                  }
                : undefined
            }
          >
            <div
              className="participant-avatar"
              style={isInstructor ? { background: '#8b5cf6' } : undefined}
            >
              {participant.name.charAt(0).toUpperCase()}
            </div>
            <span>{participant.name}</span>
            {isInstructor ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: '#8b5cf6',
                  color: '#fff',
                  marginLeft: 4,
                  letterSpacing: '0.5px',
                }}
              >
                MODERATOR
              </span>
            ) : (
              <span
                className={totalPnl >= 0 ? 'positive' : 'negative'}
                style={{ fontWeight: 700, marginLeft: 4 }}
              >
                {formatCurrency(totalEquity)} ({formatPercent(totalReturnPct)})
              </span>
            )}
          </div>

          {isInstructor ? (
            <button
              className="toolbar-btn"
              title="Exit Moderator control panel & return to login page"
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#dc2626',
                borderColor: '#ef4444',
                color: '#ffffff',
                fontWeight: 800,
                padding: '6px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 0 10px rgba(220, 38, 38, 0.45)',
              }}
            >
              <LogOut size={15} />
              <span>Exit Moderator</span>
            </button>
          ) : (
            <button
              className="toolbar-btn"
              title="Leave workshop & log out"
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
              }}
            >
              <LogOut size={14} />
              <span>Exit</span>
            </button>
          )}
        </div>
      </header>

      {/* 4-Phase Day Status & Timer Bar */}
      <div className="workshop-phase-bar">
        <div className="phase-stepper">
          {WORKSHOP_PHASES.map((p) => {
            const isPast = currentPhase.day > p.day;
            const isCurrent = currentPhase.day === p.day;
            return (
              <div
                key={p.id}
                className={`phase-step-item ${isCurrent ? 'active' : ''} ${isPast ? 'completed' : ''}`}
                style={{ borderColor: isCurrent ? p.themeColor : undefined }}
              >
                <span
                  className="phase-step-num"
                  style={{ background: isCurrent ? p.themeColor : undefined }}
                >
                  {isPast ? '✓' : p.day}
                </span>
                <span className="phase-step-name">{p.shortName}</span>
              </div>
            );
          })}
        </div>

        <div className="phase-meta-info">
          {isPhaseBreak ? (
            <div className="phase-status-tag break">
              <span>⏸</span>
              <span>Day {phaseBreakDay} Finished — Study & Analysis Break</span>
            </div>
          ) : currentPhase.day >= 1 && currentPhase.day <= 4 ? (
            <div
              className="phase-status-tag active"
              style={{ borderColor: currentPhase.themeColor }}
            >
              <span style={{ color: currentPhase.themeColor }}>●</span>
              <span>{currentPhase.name}</span>
              <span className="phase-timer-pill">
                ⏳ {formatPhaseTime(secondsRemainingInDay)} left
              </span>
            </div>
          ) : (
            <div className="phase-status-tag warmup">
              <span>📖</span>
              <span>1-Week Pre-Market Historical Warm-Up</span>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Phase Break Banner if modal was dismissed to study chart */}
      {isPhaseBreak && dismissedPhaseBreakModal && (
        <div className="phase-break-top-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14 }}>⏸</span>
            <span>
              <strong>Market Paused (Day {phaseBreakDay} Analysis Break):</strong> Study
              charts, switch timeframes, and draw support/resistance lines.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="banner-reopen-btn"
              onClick={() => setDismissedPhaseBreakModal(false)}
            >
              View Break Summary & Standings
            </button>
            {isInstructor && (
              <button
                className="banner-open-day-btn"
                onClick={() => sendControl('START_NEXT_PHASE')}
              >
                <Play size={13} />
                Start Day {Number(phaseBreakDay) + 1}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className={`app-main ${isChartExpanded ? 'chart-expanded' : ''}`}>
        {/* Left Sidebar: Watchlist */}
        <aside className="sidebar">
          {isInstructor && (
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(239, 68, 68, 0.12)',
                borderBottom: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>MODERATOR MODE</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>Room: {participant.roomCode}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 5,
                  padding: '7px 10px',
                  fontWeight: 700,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)',
                }}
              >
                <LogOut size={14} />
                <span>Exit Moderator Session</span>
              </button>
            </div>
          )}
          <div className="current-stock-info">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="current-stock-name">{currentStock.symbol}</div>
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#1a2035',
                  color: '#94a3b8',
                }}
              >
                {currentStock.sector}
              </span>
            </div>
            <div className="current-stock-fullname">{currentStock.name}</div>
            <div className="current-price-display">
              <span className="current-price-value">₹{currentPrice.toFixed(2)}</span>
              <span
                className={`current-price-change ${
                  dayChangePct >= 0 ? 'positive' : 'negative'
                }`}
              >
                {dayChangeAmount >= 0 ? '+' : ''}₹{dayChangeAmount.toFixed(2)} ({formatPercent(dayChangePct)})
              </span>
            </div>
          </div>

          <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Workshop Watchlist</span>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'none' }}>
              Day's % Change
            </span>
          </div>
          <div className="stock-list">
            {STOCK_LIST.map((stock) => {
              const idx = Math.min(simIndex, stock.data.length - 1);
              const cur = stock.data[idx].close;
              const prev = stock.data[Math.max(0, idx - 1)].close;
              const stockDayStartIdx = Math.max(0, Math.floor(idx / 75) * 75);
              const dayBase = stock.data[stockDayStartIdx]?.open || cur;
              const dayPct = dayBase > 0 ? ((cur - dayBase) / dayBase) * 100 : 0;
              const tickUp = cur >= prev;

              return (
                <div
                  key={stock.symbol}
                  className={`stock-item ${
                    selectedSymbol === stock.symbol ? 'active' : ''
                  }`}
                  onClick={() => setSelectedSymbol(stock.symbol)}
                >
                  <div className="stock-item-left">
                    <span className="stock-symbol">{stock.symbol}</span>
                    <span className="stock-name">{stock.sector}</span>
                  </div>
                  <div className="stock-item-right">
                    <div
                      className="stock-price"
                      style={{ color: tickUp ? '#10b981' : '#ef4444' }}
                    >
                      ₹{cur.toFixed(2)}
                    </div>
                    <div
                      className={`stock-change ${
                        dayPct >= 0 ? 'positive' : 'negative'
                      }`}
                    >
                      {formatPercent(dayPct)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {isInstructor && (
            <div
              style={{
                padding: 12,
                borderTop: '1px solid #2a3550',
                background: '#0f1624',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#a78bfa',
                  marginBottom: 8,
                  letterSpacing: '0.5px',
                }}
              >
                Moderator Jump Points (All Screens)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {WORKSHOP_JUMP_POINTS.map((jp) => (
                  <button
                    key={jp.label}
                    className="toolbar-btn"
                    style={{ textAlign: 'left', fontSize: 11 }}
                    title={jp.desc}
                    onClick={() =>
                      sendControl('JUMP', { index: jp.index, label: jp.label })
                    }
                  >
                    {jp.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Center: Indicator Toolbar + Chart */}
        <section className="content-area">
          <div className="chart-toolbar">
            <div className="toolbar-group" style={{ flexWrap: 'wrap' }}>
              <span className="speed-label" style={{ marginRight: 2 }}>
                Timeframe:
              </span>
              <div className="timeframe-group">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.id}
                    type="button"
                    className={`timeframe-btn ${selectedTimeframe === tf.id ? 'active' : ''}`}
                    onClick={() => setSelectedTimeframe(tf.id)}
                    title={`Switch to ${tf.name} candles`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              <div className="toolbar-separator" />

              <span className="speed-label" style={{ marginRight: 2 }}>
                Overlays:
              </span>
              {OVERLAY_OPTIONS.map((ov) => (
                <button
                  key={ov.id}
                  className={`toolbar-btn ${
                    activeOverlays.includes(ov.id) ? 'active' : ''
                  }`}
                  onClick={() => toggleOverlay(ov.id)}
                >
                  {ov.label}
                </button>
              ))}
            </div>

            <div className="toolbar-group">
              <span className="speed-label" style={{ marginRight: 2 }}>
                Indicator:
              </span>
              {OSCILLATOR_OPTIONS.map((osc) => (
                <button
                  key={osc.label}
                  className={`toolbar-btn ${
                    activeOscillator === osc.id ? 'active' : ''
                  }`}
                  onClick={() => setActiveOscillator(osc.id)}
                >
                  {osc.label}
                </button>
              ))}

              <div className="toolbar-separator" />
              <button
                className={`toolbar-btn ${showTips ? 'active' : ''}`}
                onClick={() => setShowTips((s) => !s)}
                title="Toggle live educational market tip"
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Lightbulb size={13} />
                Tips
              </button>

              <div className="toolbar-separator" />
              <button
                className={`toolbar-btn ${isChartExpanded ? 'active' : ''}`}
                onClick={() => setIsChartExpanded((e) => !e)}
                title={
                  isChartExpanded
                    ? 'Exit Study Mode: Restore normal layout'
                    : 'Study Mode: Expand chart to full-screen (hides side panels)'
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  borderColor: isChartExpanded ? '#3b82f6' : undefined,
                  color: isChartExpanded ? '#fff' : '#60a5fa',
                  background: isChartExpanded ? '#2563eb' : 'rgba(59, 130, 246, 0.1)',
                  fontWeight: 600,
                }}
              >
                {isChartExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span>{isChartExpanded ? 'Exit Study' : 'Expand Chart'}</span>
              </button>
            </div>
          </div>

          {showTips && latestCandle && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 16px',
                background: 'rgba(59, 130, 246, 0.08)',
                borderBottom: '1px solid #2a3550',
                fontSize: 12,
                color: '#cbd5e1',
              }}
            >
              <Lightbulb size={15} color="#fbbf24" style={{ flexShrink: 0 }} />
              <span>
                <strong style={{ color: '#60a5fa' }}>{latestCandle.phase}:</strong>{' '}
                {latestCandle.tip}
              </span>
            </div>
          )}

          {visibleNews.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 16px',
                background: 'rgba(239, 68, 68, 0.12)',
                borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: 12,
                cursor: 'pointer',
              }}
              onClick={() => {
                setActiveTab('news');
                setUnreadNewsCount(0);
              }}
              title="Click to view news analysis & affected stocks"
            >
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  flexShrink: 0,
                }}
              >
                Breaking
              </span>
              <span
                style={{
                  color: '#f87171',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {visibleNews[0].headline}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: '#94a3b8',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>Impact: {visibleNews[0].impactSummary}</span>
                <span style={{ color: '#38bdf8' }}>→</span>
              </span>
            </div>
          )}

          <TradingChart
            symbol={selectedSymbol}
            visibleData={chartCandles}
            activeOverlays={activeOverlays}
            activeOscillator={activeOscillator}
            orders={orders}
            selectedTimeframe={selectedTimeframe}
            showPatterns={currentPhase.showPatterns}
          />
        </section>

        {/* Right Panel: Trade / Portfolio / Orders / Leaderboard */}
        <aside className="right-panel">
          <div className="panel-tabs">
            {[
              { id: 'trade', label: 'Trade' },
              { id: 'portfolio', label: 'Portfolio' },
              { id: 'orders', label: `Orders (${orders.length})` },
              { id: 'ranks', label: `Ranks (${participantCount})` },
              {
                id: 'news',
                label: `News (${visibleNews.length})`,
                badge: unreadNewsCount > 0 ? unreadNewsCount : null,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`panel-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'news') setUnreadNewsCount(0);
                }}
                style={{ position: 'relative' }}
              >
                {tab.label}
                {tab.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 2,
                      background: '#ef4444',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 14,
                      height: 14,
                      fontSize: 9,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="panel-content">
            {activeTab === 'trade' && (
              <TradePanel
                stock={currentStock}
                currentPrice={currentPrice}
                cash={cash}
                holding={holdings[selectedSymbol]}
                signals={liveSignals}
                onExecuteOrder={handleExecuteOrder}
              />
            )}

            {activeTab === 'portfolio' && (
              <PortfolioPanel
                cash={cash}
                startingCash={participant.startingCash}
                holdings={holdings}
                currentPrices={currentPrices}
                realizedPnl={realizedPnl}
                onSelectStock={(sym) => {
                  setSelectedSymbol(sym);
                  setActiveTab('trade');
                }}
              />
            )}

            {activeTab === 'orders' && (
              <div>
                {orders.length === 0 ? (
                  <div className="empty-state">
                    <History size={32} />
                    <p>No trades executed yet. Place a Buy or Sell order to see it here.</p>
                  </div>
                ) : (
                  orders.map((ord) => (
                    <div
                      key={ord.id}
                      className={`order-item ${
                        ord.type === 'BUY' ? 'buy-order' : 'sell-order'
                      }`}
                    >
                      <div className="order-header">
                        <span
                          className={`order-type ${
                            ord.type === 'BUY' ? 'positive' : 'negative'
                          }`}
                        >
                          {ord.type} {ord.symbol}
                        </span>
                        <span className="order-time">{ord.displayTime}</span>
                      </div>
                      <div className="order-details">
                        <span>
                          {ord.qty} sh @ ₹{ord.price.toFixed(2)}
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {formatCurrency(ord.total)}
                        </span>
                      </div>
                      {ord.pnl !== null && (
                        <div
                          style={{
                            fontSize: 11,
                            marginTop: 4,
                            fontWeight: 600,
                            color: ord.pnl >= 0 ? '#10b981' : '#ef4444',
                          }}
                        >
                          Realized P&amp;L: {ord.pnl >= 0 ? '+' : ''}
                          {formatCurrency(ord.pnl)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'ranks' && (
              <LeaderboardPanel
                clientId={clientId}
                participantName={participant.name}
                roomCode={participant.roomCode}
                totalEquity={totalEquity}
                startingCash={participant.startingCash}
                ordersCount={orders.length}
                liveLeaderboard={liveLeaderboard}
                wsConnected={wsConnected}
                participantCount={participantCount}
                competitionEnded={competitionEnded}
              />
            )}

            {activeTab === 'news' && (
              <NewsPanel
                visibleNews={visibleNews}
                selectedSymbol={selectedSymbol}
                currentDay={currentPhase.day}
                stockList={STOCK_LIST}
                onSelectStock={(sym) => {
                  setSelectedSymbol(sym);
                }}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="status-bar">
        <div className="status-left">
          <span>
            <span className={`status-dot ${isPlaying ? 'live' : 'paused'}`} />
            {isPlaying ? 'Room Simulation Running' : 'Room Simulation Paused'}
          </span>
          <span>
            {wsConnected
              ? `Connected to ${participant.roomCode} (${participantCount} traders)`
              : 'Offline Mode (Local Only)'}
          </span>
        </div>
        <div className="status-right">
          <span>Available Cash: {formatCurrency(cash)}</span>
          <span>Active Overlays: {activeOverlays.length}</span>
        </div>
      </footer>
    </div>
  );
}
