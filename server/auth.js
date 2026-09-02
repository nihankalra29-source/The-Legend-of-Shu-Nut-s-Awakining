const crypto = require('crypto');

// In-memory session store: token -> username (lowercase id).
// Sessions reset on server restart; fine for this project's scope.
const sessions = new Map();

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, userId);
  return token;
}

function getUserIdForToken(token) {
  return sessions.get(token) || null;
}

function destroySession(token) {
  sessions.delete(token);
}

module.exports = { createSession, getUserIdForToken, destroySession };
