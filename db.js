const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], items: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getUserByName(username) {
  const db = load();
  return db.users.find(user => user.username === username) || null;
}

function getUserByEmail(email) {
  if (!email) return null;
  const db = load();
  return db.users.find(user => user.email === email) || null;
}

function getUserByGoogleId(googleId) {
  if (!googleId) return null;
  const db = load();
  return db.users.find(user => user.googleId === googleId) || null;
}

function userExists(username) {
  return !!getUserByName(username);
}

function insertUser(userData) {
  const db = load();
  const nextId = db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
  const user = {
    id: nextId,
    username: userData.username,
    password: userData.password || null,
    email: userData.email || null,
    googleId: userData.googleId || null,
    created: Date.now()
  };
  db.users.push(user);
  save(db);
  return user;
}

function getUserById(id) {
  const db = load();
  return db.users.find(user => user.id === id) || null;
}

function getItems() {
  const db = load();
  return [...db.items].sort((a, b) => b.created - a.created);
}

function insertItem(item) {
  const db = load();
  const nextId = db.items.length ? Math.max(...db.items.map(i => i.id)) + 1 : 1;
  const entry = { id: nextId, ...item };
  db.items.push(entry);
  save(db);
  return entry;
}

function getItemById(id) {
  const db = load();
  return db.items.find(item => item.id === id) || null;
}

function deleteItem(id) {
  const db = load();
  db.items = db.items.filter(item => item.id !== id);
  save(db);
}

module.exports = {
  getUserByName,
  getUserByEmail,
  getUserByGoogleId,
  userExists,
  insertUser,
  getUserById,
  getItems,
  insertItem,
  getItemById,
  deleteItem
};
