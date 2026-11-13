import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const PORT = Number(process.env.PORT) || 4000;
const INITIAL_CANDLES = 375; // 5 full trading days (1 week) * 75 candles
const DEFAULT_MAX_CANDLES = 2250; // 30 trading days * 75 candles
const MODERATOR_PASSWORD = '0000';

const PHASES = [
  { day: 1, startCandle: 375, endCandle: 449, name: 'Day 1: Pure Technical Moves', hasNews: false, showPatterns: false },
  { day: 2, startCandle: 450, endCandle: 524, name: 'Day 2: News Catalysts & Candlestick Patterns', hasNews: true, showPatterns: true },
  { day: 3, startCandle: 525, endCandle: 599, name: 'Day 3: Macro Shocks & Commodity Volatility', hasNews: true, showPatterns: true },
  { day: 4, startCandle: 600, endCandle: 674, name: 'Day 4: Competition Grand Finale', hasNews: true, showPatterns: true },
];
const COMPETITION_END_CANDLE = 674;
const BASE_SPEED_MS = 6400; // 75 candles * 6.4s = 480s (exactly 8 minutes per trading day)

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

// HTTP Server: Serves production frontend build (dist) if present, or health check
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port: PORT }));
    return;
  }

  // Serve static dist files if dist folder exists (Production Hosting)
  if (fs.existsSync(distPath)) {
    const safeUrl = req.url.split('?')[0];
    let filePath = path.join(distPath, safeUrl === '/' ? 'index.html' : safeUrl);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distPath, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    } catch {
      // Fall through to 404
    }
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TradeLab Workshop WebSocket server running');
});

// WebSocket Server attached to HTTP server
const wss = new WebSocketServer({ server });

// Map<roomCode, RoomState>
const rooms = new Map();

function getPhaseInfo(candleIndex) {
  for (const p of PHASES) {
    if (candleIndex >= p.startCandle && candleIndex <= p.endCandle) {
      return p;
    }
  }
  if (candleIndex < INITIAL_CANDLES) {
    return { day: 0, name: 'Pre-Market 1-Week History', hasNews: false, showPatterns: false };
  }
  return { day: 5, name: 'Competition Finished', hasNews: true, showPatterns: true };
}

function getOrCreateRoom(roomCode, maxCandles = DEFAULT_MAX_CANDLES) {
  const code = (roomCode || 'WORKSHOP-101').toUpperCase();
  if (!rooms.has(code)) {
    rooms.set(code, {
      code,
      simIndex: INITIAL_CANDLES,
      maxCandles,
      isPlaying: false,
      speedMs: BASE_SPEED_MS, // 6400ms = 8 minutes per 75-candle day at 1x
      speedMultiplier: 1,
      isPhaseBreak: false,
      phaseBreakDay: null,
      competitionEnded: false,
      timer: null,
      participants: new Map(), // clientId -> participantData
      sockets: new Map(), // clientId -> WebSocket
    });
  }
  return rooms.get(code);
}

function buildLeaderboard(room) {
  return Array.from(room.participants.values())
    .filter((p) => p.role !== 'instructor')
    .concat(
      Array.from(room.participants.values()).filter(
        (p) => p.role === 'instructor' && p.trades > 0
      )
    )
    .sort((a, b) => b.returnPct - a.returnPct || b.equity - a.equity);
}

function broadcastRoomState(room, extra = {}) {
  const phase = getPhaseInfo(room.simIndex);
  const payload = JSON.stringify({
    type: 'ROOM_STATE',
    roomCode: room.code,
    simIndex: room.simIndex,
    isPlaying: room.isPlaying,
    speedMs: room.speedMs,
    speedMultiplier: room.speedMultiplier,
    currentDay: phase.day,
    phaseName: phase.name,
    hasNews: phase.hasNews,
    showPatterns: phase.showPatterns,
    isPhaseBreak: room.isPhaseBreak,
    phaseBreakDay: room.phaseBreakDay,
    competitionEnded: room.competitionEnded,
    participantCount: room.participants.size,
    leaderboard: buildLeaderboard(room),
    ...extra,
  });

  for (const ws of room.sockets.values()) {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  }
}

function broadcastEvent(room, type, data = {}) {
  const payload = JSON.stringify({ type, ...data });
  for (const ws of room.sockets.values()) {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  }
}

function stopRoomTimer(room) {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
}

function startRoomTimer(room) {
  stopRoomTimer(room);
  if (!room.isPlaying || room.competitionEnded) return;

  room.timer = setInterval(() => {
    // Check if current candle reaches the end of Phase 1, 2, or 3
    if (room.simIndex === 449) {
      // Day 1 ended
      room.isPlaying = false;
      room.isPhaseBreak = true;
      room.phaseBreakDay = 1;
      stopRoomTimer(room);
      broadcastRoomState(room, {
        notice: 'Day 1 Complete! Market is now closed for Study & Analysis Break.',
      });
      return;
    }
    if (room.simIndex === 524) {
      // Day 2 ended
      room.isPlaying = false;
      room.isPhaseBreak = true;
      room.phaseBreakDay = 2;
      stopRoomTimer(room);
      broadcastRoomState(room, {
        notice: 'Day 2 Complete! Market is now closed for Study & Analysis Break.',
      });
      return;
    }
    if (room.simIndex === 599) {
      // Day 3 ended
      room.isPlaying = false;
      room.isPhaseBreak = true;
      room.phaseBreakDay = 3;
      stopRoomTimer(room);
      broadcastRoomState(room, {
        notice: 'Day 3 Complete! Market is now closed for Study & Analysis Break.',
      });
      return;
    }
    if (room.simIndex >= COMPETITION_END_CANDLE) {
      // Day 4 ended -> Grand finale!
      room.isPlaying = false;
      room.isPhaseBreak = false;
      room.competitionEnded = true;
      stopRoomTimer(room);
      broadcastRoomState(room, {
        notice: 'Competition Finished! The final closing bell has rung. Check the leaderboard for the winner!',
      });
      return;
    }

    room.simIndex += 1;
    const phase = getPhaseInfo(room.simIndex);
    broadcastEvent(room, 'TICK', {
      simIndex: room.simIndex,
      isPlaying: room.isPlaying,
      currentDay: phase.day,
      phaseName: phase.name,
      hasNews: phase.hasNews,
      showPatterns: phase.showPatterns,
    });
  }, room.speedMs);
}

wss.on('connection', (ws) => {
  let currentRoom = null;
  let currentClientId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'JOIN') {
      const room = getOrCreateRoom(msg.roomCode, msg.maxCandles || DEFAULT_MAX_CANDLES);
      currentRoom = room;
      currentClientId = msg.clientId;

      const requestedRole = msg.role || 'participant';

      if (requestedRole === 'instructor') {
        if (msg.moderatorPassword !== MODERATOR_PASSWORD) {
          ws.send(
            JSON.stringify({
              type: 'JOIN_ERROR',
              message: 'Incorrect Moderator password. Please enter the correct PIN.',
            })
          );
          return;
        }

        // Check if another moderator is already actively connected
        let activeMod = null;
        for (const p of room.participants.values()) {
          if (p.role === 'instructor' && p.id !== currentClientId) {
            const modSocket = room.sockets.get(p.id);
            if (modSocket && modSocket.readyState === 1) {
              activeMod = p;
              break;
            }
          }
        }

        if (activeMod) {
          ws.send(
            JSON.stringify({
              type: 'JOIN_ERROR',
              message: `A moderator (${activeMod.name}) is already active in this session. Only 1 moderator is allowed at a time.`,
            })
          );
          return;
        }
      }

      const verifiedRole = requestedRole === 'instructor' ? 'instructor' : 'participant';

      const existing = room.participants.get(currentClientId);
      if (room.emptyCleanupTimer) {
        clearTimeout(room.emptyCleanupTimer);
        room.emptyCleanupTimer = null;
      }

      room.sockets.set(currentClientId, ws);
      room.participants.set(currentClientId, {
        id: currentClientId,
        name: msg.name || existing?.name || 'Trader',
        role: verifiedRole,
        startingCash: msg.startingCash || existing?.startingCash || 1000000,
        equity: msg.equity ?? existing?.equity ?? msg.startingCash ?? 1000000,
        returnPct: msg.returnPct ?? existing?.returnPct ?? 0,
        trades: msg.trades ?? existing?.trades ?? 0,
      });

      broadcastRoomState(room);
      return;
    }

    if (!currentRoom || !currentClientId) return;

    if (msg.type === 'LEAVE') {
      currentRoom.sockets.delete(currentClientId);
      currentRoom.participants.delete(currentClientId);
      broadcastRoomState(currentRoom);
      return;
    }

    if (msg.type === 'PORTFOLIO_UPDATE') {
      const p = currentRoom.participants.get(currentClientId);
      if (p) {
        p.equity = msg.equity;
        p.returnPct = msg.returnPct;
        p.trades = msg.trades;
        broadcastEvent(currentRoom, 'LEADERBOARD_UPDATE', {
          leaderboard: buildLeaderboard(currentRoom),
          participantCount: currentRoom.participants.size,
        });
      }
      return;
    }

    if (msg.type === 'INSTRUCTOR_CONTROL') {
      const sender = currentRoom.participants.get(currentClientId);
      if (!sender || sender.role !== 'instructor') {
        console.warn(`Unauthorized control attempt from client ${currentClientId}`);
        return;
      }

      const action = msg.action;

      if (action === 'PLAY') {
        if (currentRoom.competitionEnded || currentRoom.simIndex >= COMPETITION_END_CANDLE) {
          currentRoom.simIndex = INITIAL_CANDLES;
          currentRoom.competitionEnded = false;
        }
        if (currentRoom.isPhaseBreak) {
          // Advancing past break into next day candle
          currentRoom.isPhaseBreak = false;
          currentRoom.phaseBreakDay = null;
          currentRoom.simIndex += 1;
        }
        currentRoom.isPlaying = true;
        startRoomTimer(currentRoom);
        broadcastRoomState(currentRoom);
      } else if (action === 'START_NEXT_PHASE') {
        currentRoom.isPhaseBreak = false;
        currentRoom.phaseBreakDay = null;
        if (currentRoom.simIndex === 449) currentRoom.simIndex = 450;
        else if (currentRoom.simIndex === 524) currentRoom.simIndex = 525;
        else if (currentRoom.simIndex === 599) currentRoom.simIndex = 600;
        currentRoom.isPlaying = true;
        startRoomTimer(currentRoom);
        broadcastRoomState(currentRoom);
      } else if (action === 'PAUSE') {
        currentRoom.isPlaying = false;
        stopRoomTimer(currentRoom);
        broadcastRoomState(currentRoom);
      } else if (action === 'STEP') {
        currentRoom.isPlaying = false;
        stopRoomTimer(currentRoom);
        const delta = msg.step || 1;
        currentRoom.simIndex = Math.min(
          COMPETITION_END_CANDLE,
          currentRoom.simIndex + delta
        );
        broadcastRoomState(currentRoom);
      } else if (action === 'SET_SPEED') {
        if (msg.multiplier) {
          const mult = Number(msg.multiplier) || 1;
          currentRoom.speedMultiplier = mult;
          currentRoom.speedMs = Math.max(50, Math.round(BASE_SPEED_MS / mult));
        } else if (msg.speedMs) {
          currentRoom.speedMs = Math.max(50, Math.min(10000, Number(msg.speedMs) || 6400));
          currentRoom.speedMultiplier = Math.round((BASE_SPEED_MS / currentRoom.speedMs) * 10) / 10;
        }
        if (currentRoom.isPlaying) {
          startRoomTimer(currentRoom);
        }
        broadcastRoomState(currentRoom);
      } else if (action === 'JUMP') {
        const target = Math.max(
          INITIAL_CANDLES,
          Math.min(COMPETITION_END_CANDLE, Number(msg.index) || INITIAL_CANDLES)
        );
        currentRoom.simIndex = target;
        currentRoom.isPhaseBreak = false;
        currentRoom.phaseBreakDay = null;
        broadcastRoomState(currentRoom, { notice: `Moderator jumped to ${msg.label}` });
      } else if (action === 'END_COMPETITION') {
        currentRoom.isPlaying = false;
        currentRoom.competitionEnded = true;
        currentRoom.isPhaseBreak = false;
        stopRoomTimer(currentRoom);
        broadcastRoomState(currentRoom);
      } else if (action === 'RESET_ROOM') {
        currentRoom.isPlaying = false;
        currentRoom.competitionEnded = false;
        currentRoom.isPhaseBreak = false;
        currentRoom.phaseBreakDay = null;
        currentRoom.simIndex = INITIAL_CANDLES;
        stopRoomTimer(currentRoom);
        for (const p of currentRoom.participants.values()) {
          p.equity = p.startingCash;
          p.returnPct = 0;
          p.trades = 0;
        }
        broadcastEvent(currentRoom, 'ROOM_RESET', {});
        broadcastRoomState(currentRoom);
      }
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentClientId) {
      currentRoom.sockets.delete(currentClientId);
      const disconnectedId = currentClientId;
      const room = currentRoom;

      // 10-second grace period before removing participant to allow instant page refresh
      setTimeout(() => {
        if (!room.sockets.has(disconnectedId)) {
          room.participants.delete(disconnectedId);
          if (room.sockets.size === 0) {
            stopRoomTimer(room);
            // Allow 10 minutes before deleting room state
            if (!room.emptyCleanupTimer) {
              room.emptyCleanupTimer = setTimeout(() => {
                if (room.sockets.size === 0) {
                  rooms.delete(room.code);
                }
              }, 10 * 60 * 1000);
            }
          } else {
            broadcastRoomState(room);
          }
        }
      }, 10000);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TradeLab Workshop Web & WebSocket server listening on http://0.0.0.0:${PORT}`);
});


