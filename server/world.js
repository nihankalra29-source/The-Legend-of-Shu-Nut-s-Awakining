const store = require('./store');

// socket -> { ws, userId, username, role, x, y, dir }
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

function broadcast(msg, exceptId) {
  const payload = JSON.stringify(msg);
  for (const p of online.values()) {
    if (p.id === exceptId) continue;
    if (p.ws.readyState === 1) p.ws.send(payload);
  }
}

function sendTo(id, msg) {
  const p = online.get(id);
  if (p && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
}

// pending teleport requests: targetLower -> { fromId, fromUsername, expiresAt }
const pendingTpa = new Map();

module.exports = { online, banStatus, findOnlineByName, publicPlayer, broadcast, sendTo, pendingTpa };
