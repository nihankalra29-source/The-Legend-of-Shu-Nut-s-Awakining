const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const OWNER_EMAIL = 'nihankalra2015@gmail.com';

const ITEM_IDS = ['acorn_key', 'husk_lantern'];

function emptyInventory() {
  return { acorn_key: 0, husk_lantern: 0 };
}

// Fills in fields added after some accounts were already created, so old
// save files keep working without a migration step.
function backfillEconomy(user) {
  if (typeof user.balance !== 'number' || user.balance < 0) user.balance = 0;
  if (!user.inventory) user.inventory = emptyInventory();
  for (const id of ITEM_IDS) {
    if (typeof user.inventory[id] !== 'number' || user.inventory[id] < 0) user.inventory[id] = 0;
  }
  return user;
}

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) return { users: {}, listings: [], nextListingId: 1 };
  let data;
  try {
    data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    data = { users: {} };
  }
  data.users = data.users || {};
  data.listings = data.listings || [];
  data.nextListingId = data.nextListingId || 1;
  for (const user of Object.values(data.users)) backfillEconomy(user);
  return data;
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
    balance: 0,
    inventory: emptyInventory(),
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

// Creates a fixed account from BOOTSTRAP_* env vars if it doesn't exist yet.
// Lets an owner account survive a host with no persistent disk (e.g.
// Render's free plan resets the filesystem on every deploy) without
// exposing a network-facing "make me owner" endpoint. Never touches an
// account that already exists, so it won't stomp a changed password.
function ensureBootstrapUser() {
  const { BOOTSTRAP_USERNAME: username, BOOTSTRAP_PASSWORD: password } = process.env;
  if (!username || !password) return;
  const key = username.toLowerCase();
  if (db.users[key]) return;
  const email = process.env.BOOTSTRAP_EMAIL || '';
  const { salt, hash } = hashPassword(password);
  db.users[key] = {
    id: key,
    username,
    email,
    emailLower: email.trim().toLowerCase(),
    salt,
    hash,
    role: process.env.BOOTSTRAP_ROLE || 'owner',
    banned: null,
    balance: 0,
    inventory: emptyInventory(),
    createdAt: Date.now(),
  };
  persist();
  console.log(`Bootstrapped account "${username}" as ${db.users[key].role}.`);
}

ensureBootstrapUser();

function publicUser(user) {
  if (!user) return null;
  return {
    username: user.username,
    role: user.role,
    banned: user.banned,
  };
}

function getListings() {
  return db.listings;
}

function addListing(listing) {
  db.listings.push(listing);
  persist();
}

function removeListing(id) {
  const idx = db.listings.findIndex(l => l.id === id);
  if (idx === -1) return null;
  const [listing] = db.listings.splice(idx, 1);
  persist();
  return listing;
}

function nextListingId() {
  const id = db.nextListingId;
  db.nextListingId += 1;
  persist();
  return id;
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
  getListings,
  addListing,
  removeListing,
  nextListingId,
  ITEM_IDS,
  OWNER_EMAIL,
};
