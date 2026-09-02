const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const OWNER_EMAIL = 'nihankalra2015@gmail.com';

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) return { users: {} };
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return { users: {} };
  }
}

let db = load();

function persist() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

function isOwnerEmail(email) {
  return email.trim().toLowerCase() === OWNER_EMAIL;
}

function findByUsername(username) {
  return db.users[username.toLowerCase()] || null;
}

function findByEmail(email) {
  const lower = email.trim().toLowerCase();
  return Object.values(db.users).find(u => u.emailLower === lower) || null;
}

function createUser(username, email, password) {
  const key = username.toLowerCase();
  if (db.users[key]) throw new Error('That username is already taken.');
  if (findByEmail(email)) throw new Error('That email is already registered.');
  const { salt, hash } = hashPassword(password);
  const user = {
    id: key,
    username,
    email,
    emailLower: email.trim().toLowerCase(),
    salt,
    hash,
    role: isOwnerEmail(email) ? 'owner' : 'player',
    banned: null,
    createdAt: Date.now(),
  };
  db.users[key] = user;
  persist();
  return user;
}

function saveUser(user) {
  db.users[user.id] = user;
  persist();
}

function publicUser(user) {
  if (!user) return null;
  return {
    username: user.username,
    role: user.role,
    banned: user.banned,
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  isOwnerEmail,
  findByUsername,
  findByEmail,
  createUser,
  saveUser,
  publicUser,
  OWNER_EMAIL,
};
