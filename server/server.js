const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

const store = require('./store');
const auth = require('./auth');
const world = require('./world');
const commands = require('./commands');
const worldmaps = require('./worldmaps');

const PORT = process.env.PORT || 3000;
const SPAWN = { x: 336, y: 272 }; // village map, tile (10, 8)

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(__dirname, '..')));

const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function banMessage(status) {
  if (status.until === null) return `You are banned. Reason: ${status.reason}`;
  const mins = Math.ceil((status.until - Date.now()) / 60000);
  return `You are temporarily banned for ${mins} more minute(s). Reason: ${status.reason}`;
}

app.post('/api/signup', (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-16 letters, numbers, or underscores.' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const user = store.createUser(username, email, password);
    const token = auth.createSession(user.id);
    res.json({ token, user: store.publicUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = store.findByUsername(username || '');
  if (!user || !store.verifyPassword(password || '', user.salt, user.hash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  const status = world.banStatus(user);
  if (status.banned) return res.status(403).json({ error: banMessage(status) });
  const token = auth.createSession(user.id);
  res.json({ token, user: store.publicUser(user) });
});

app.get('/api/me', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const userId = auth.getUserIdForToken(token);
  const user = userId && store.findByUsername(userId);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });
  res.json({ user: store.publicUser(user) });
});

const server = app.listen(PORT, () => {
  console.log(`The Legend of Shu server running at http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  let joined = false;
  const authTimeout = setTimeout(() => {
    if (!joined) ws.close(4001, 'Auth timeout');
  }, 8000);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'auth' && !joined) {
      const userId = auth.getUserIdForToken(msg.token || '');
      const user = userId && store.findByUsername(userId);
      if (!user) return ws.close(4002, 'Invalid session');
      const status = world.banStatus(user);
      if (status.banned) return ws.close(4003, banMessage(status));
      if (world.findOnlineByName(user.username)) return ws.close(4004, 'Already connected elsewhere');

      joined = true;
      clearTimeout(authTimeout);
      const id = crypto.randomUUID();
      const jitter = () => Math.floor(Math.random() * 48 - 24);
      const entry = {
        id, ws, username: user.username, role: user.role, map: 'village',
        x: SPAWN.x + jitter(), y: SPAWN.y + jitter(), dir: 'down',
      };
      world.online.set(id, entry);
      ws._playerId = id;

      ws.send(JSON.stringify({
        type: 'welcome',
        you: world.publicPlayer(entry),
        players: world.playersInMap(entry.map, id),
      }));
      world.broadcastToMap(entry.map, { type: 'playerJoined', player: world.publicPlayer(entry) }, id);
      return;
    }

    if (!joined) return;
    const entry = world.online.get(ws._playerId);
    if (!entry) return;

    if (msg.type === 'move') {
      const x = Number(msg.x);
      const y = Number(msg.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      entry.dir = msg.dir || entry.dir;

      const tx = Math.floor(x / worldmaps.TILE_SIZE);
      const ty = Math.floor(y / worldmaps.TILE_SIZE);
      const transition = worldmaps.findTransition(entry.map, tx, ty);
      const user = store.findByUsername(entry.username);

      if (transition && user && (!transition.requires || user.inventory[transition.requires] > 0)) {
        if (transition.requires) {
          user.inventory[transition.requires] -= 1;
          store.saveUser(user);
        }
        const destX = transition.toX * worldmaps.TILE_SIZE + worldmaps.TILE_SIZE / 2;
        const destY = transition.toY * worldmaps.TILE_SIZE + worldmaps.TILE_SIZE / 2;
        world.changeMap(entry, transition.toMap, destX, destY);
        ws.send(JSON.stringify({
          type: 'mapChanged',
          map: transition.toMap,
          x: destX,
          y: destY,
          players: world.playersInMap(transition.toMap, entry.id),
        }));
        return;
      }

      world.changeMap(entry, entry.map, x, y);
      return;
    }

    if (msg.type === 'chat') {
      const text = String(msg.text || '').slice(0, 300);
      if (!text) return;
      if (text.startsWith('/')) {
        commands.handleCommand({ player: entry, send: (m) => ws.send(JSON.stringify(m)) }, text);
      } else {
        world.broadcast({ type: 'chat', from: entry.username, role: entry.role, text });
      }
      return;
    }
  });

  ws.on('close', () => {
    clearTimeout(authTimeout);
    if (joined) {
      const entry = world.online.get(ws._playerId);
      world.online.delete(ws._playerId);
      if (entry) world.broadcastToMap(entry.map, { type: 'playerLeft', id: ws._playerId });
    }
  });
});
