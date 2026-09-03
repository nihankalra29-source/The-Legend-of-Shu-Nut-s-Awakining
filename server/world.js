const store = require('./store');

// socket -> { ws, userId, username, role, map, x, y, dir }
const online = new Map();

function banStatus(user) {
  if (!user.banned) return { banned: false };
  if (user.banned.until !== null && user.banned.until <= Date.now()) {
    user.banned = null;
    store.saveUser(user);
    return { banned: false };
  }
  return { banned: true, reason: user.banned.reason, until: user.banned.until };
}

function findOnlineByName(name) {
  const lower = name.toLowerCase();
  for (const p of online.values()) {
    if (p.username.toLowerCase() === lower) return p;
  }
  return null;
}

function publicPlayer(p) {
  return { id: p.id, username: p.username, role: p.role, x: p.x, y: p.y, dir: p.dir };
}

function playersInMap(mapId, exceptId) {
  const list = [];
  for (const p of online.values()) {
    if (p.map === mapId && p.id !== exceptId) list.push(publicPlayer(p));
  }
  return list;
}

function broadcast(msg, exceptId) {
  const payload = JSON.stringify(msg);
  for (const p of online.values()) {
    if (p.id === exceptId) continue;
    if (p.ws.readyState === 1) p.ws.send(payload);
  }
}

function broadcastToMap(mapId, msg, exceptId) {
  const payload = JSON.stringify(msg);
  for (const p of online.values()) {
    if (p.id === exceptId || p.map !== mapId) continue;
    if (p.ws.readyState === 1) p.ws.send(payload);
  }
}

function sendTo(id, msg) {
  const p = online.get(id);
  if (p && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
}

// Moves a player between maps (or just to a new spot in the same one),
// telling only the players who need to know: the old map sees them leave,
// the new map sees them arrive.
function changeMap(entry, mapId, x, y) {
  const oldMap = entry.map;
  entry.x = x;
  entry.y = y;
  if (oldMap === mapId) {
    broadcastToMap(mapId, { type: 'playerMoved', id: entry.id, x, y, dir: entry.dir }, entry.id);
    return;
  }
  broadcastToMap(oldMap, { type: 'playerLeft', id: entry.id }, entry.id);
  entry.map = mapId;
  broadcastToMap(mapId, { type: 'playerJoined', player: publicPlayer(entry) }, entry.id);
}

// pending teleport requests: targetLower -> { fromId, fromUsername, expiresAt }
const pendingTpa = new Map();

module.exports = {
  online, banStatus, findOnlineByName, publicPlayer, playersInMap,
  broadcast, broadcastToMap, sendTo, changeMap, pendingTpa,
};
