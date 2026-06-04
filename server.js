require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_CONDITIONS = ['New', 'Like New', 'Used', 'For parts'];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
    }
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname)));

const {
  userExists,
  getUserByName,
  getUserByEmail,
  getUserByGoogleId,
  insertUser,
  getUserById,
  getItems,
  insertItem,
  getItemById,
  deleteItem
} = db;

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

const mailTransport = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT || 587),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

async function sendWelcomeEmail(email, username) {
  if (!email) return;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Skipping welcome email because email credentials are not configured.');
    return;
  }
  try {
    await mailTransport.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to Trendy Trades',
      text: `Hi ${username},\n\nYou have successfully registered with Trendy Trades using your Google account. You can now create listings and sell items!\n\nThank you,\nTrendy Trades Team`,
      html: `<p>Hi <strong>${username}</strong>,</p><p>You have successfully registered with Trendy Trades using your Google account. You can now create listings and sell items!</p><p>Thank you,<br/>Trendy Trades Team</p>`
    });
  } catch (err) {
    console.error('Failed to send welcome email:', err.message);
  }
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = getUserById(id);
  done(null, user || null);
});

const googleAuthEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (googleAuthEnabled) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    const existing = getUserByGoogleId(profile.id) || getUserByEmail(email);
    if (existing) {
      if (!existing.googleId) {
        existing.googleId = profile.id;
        const dbState = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
        const userIndex = dbState.users.findIndex(u => u.id === existing.id);
        if (userIndex !== -1) {
          dbState.users[userIndex] = existing;
          fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(dbState, null, 2));
        }
      }
      return done(null, existing);
    }

    let username = profile.displayName?.replace(/\s+/g, '') || email?.split('@')[0] || `user${Date.now()}`;
    username = username.replace(/[^a-zA-Z0-9_]/g, '');
    let unique = username;
    let attempt = 1;
    while (userExists(unique)) {
      unique = `${username}${attempt++}`;
    }

    const user = insertUser({
      username: unique,
      password: null,
      email,
      googleId: profile.id
    });
    await sendWelcomeEmail(email, unique);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));
}

function validateUsername(username) {
  return typeof username === 'string' && /^[a-zA-Z0-9_]{3,24}$/.test(username);
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function validateTitle(title) {
  return typeof title === 'string' && title.trim().length >= 3 && title.trim().length <= 100;
}

function validateDescription(description) {
  return typeof description === 'string' && description.trim().length <= 500;
}

function validatePrice(price) {
  const value = Number(price);
  return Number.isFinite(value) && value >= 0 && value <= 100000;
}

function validateCondition(condition) {
  return ALLOWED_CONDITIONS.includes(condition);
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return sendError(res, 401, 'missing auth');
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return sendError(res, 401, 'invalid auth');
  const token = parts[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return sendError(res, 401, 'invalid token');
  }
}

if (googleAuthEnabled) {
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/?auth=failed' }), (req, res) => {
    const token = jwt.sign({ id: req.user.id, username: req.user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.send(`<!doctype html><html><body><script>
      localStorage.setItem('tt_token', '${token}');
      window.location = '/';
    </script><p>Redirecting...</p></body></html>`);
  });
} else {
  app.get('/auth/google', (req, res) => sendError(res, 400, 'Google auth not configured'));
  app.get('/auth/google/callback', (req, res) => sendError(res, 400, 'Google auth not configured'));
}

app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body || {};
  if (!validateUsername(username)) {
    return sendError(res, 400, 'Username must be 3-24 characters and may contain letters, numbers, and underscores.');
  }
  if (!validatePassword(password)) {
    return sendError(res, 400, 'Password must be at least 8 characters.');
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return sendError(res, 400, 'Invalid email address.');
  }
  if (userExists(username)) {
    return sendError(res, 409, 'username taken');
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = insertUser({ username, password: hashed, email });
  if (email) await sendWelcomeEmail(email, username);
  const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!validateUsername(username) || !validatePassword(password)) {
    return sendError(res, 400, 'Invalid login credentials.');
  }
  const user = getUserByName(username);
  if (!user) return sendError(res, 400, 'Invalid login credentials.');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return sendError(res, 400, 'Invalid login credentials.');
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

app.get('/api/items', (req, res) => {
  const rows = getItems();
  const items = rows.map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    price: r.price,
    condition: r.condition,
    image: r.image ? `/uploads/${r.image}` : null,
    user_id: r.user_id,
    username: r.username,
    created: r.created
  }));
  res.json({ items });
});

app.post('/api/items', authMiddleware, (req, res, next) => {
  upload.single('image')(req, res, async err => {
    if (err) return next(err);
    const { title, description = '', price = '0', condition } = req.body || {};
    if (!validateTitle(title)) {
      return sendError(res, 400, 'Title must be 3-100 characters.');
    }
    if (!validateDescription(description)) {
      return sendError(res, 400, 'Description must be 500 characters or less.');
    }
    if (!validatePrice(price)) {
      return sendError(res, 400, 'Price must be a number between 0 and 100,000.');
    }
    if (!validateCondition(condition)) {
      return sendError(res, 400, 'Invalid condition value.');
    }
    const image = req.file ? req.file.filename : null;
    const item = insertItem({
      user_id: req.user.id,
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      condition,
      image,
      created: Date.now()
    });
    res.json({ item: { ...item, image: item.image ? `/uploads/${item.image}` : null } });
  });
});

app.delete('/api/items/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const item = getItemById(id);
  if (!item) return sendError(res, 404, 'Item not found');
  if (item.user_id !== req.user.id) return sendError(res, 403, 'not owner');
  if (item.image) {
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, item.image));
    } catch (e) {
      console.warn('Could not remove image', e.message);
    }
  }
  deleteItem(id);
  res.json({ success: true });
});

app.use((err, req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError || err.message) {
    return sendError(res, 400, err.message);
  }
  console.error(err);
  return sendError(res, 500, 'Server error');
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
