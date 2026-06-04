# Trendy Trades

Simple static demo for a dark-themed buy/sell site.

How to run
- Open [index.html](index.html) in your browser.
- Add items using the form; listings are saved to `localStorage` in your browser.

Files
- [index.html](index.html) — main page
- [styles.css](styles.css) — dark theme styles
- [app.js](app.js) — client-side behavior

Next steps (optional)
- Add image upload support or cloud storage
- Add server/API for persistent listings and user accounts

Backend-enabled run (Node.js)

1. Install dependencies

```bash
npm install
```

2. Start server

```bash
npm start
```

3. Configure environment

Create a `.env` file with at least:

```bash
PORT=4000
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password
EMAIL_FROM="Trendy Trades" <your-email@example.com>
```

The server serves the frontend and exposes API endpoints:
- `POST /api/register` — register {username,password,email?}
- `POST /api/login` — login {username,password}
- `GET /api/items` — list items
- `POST /api/items` — create item (multipart form, include `image` file) — requires `Authorization: Bearer <token>`
- `DELETE /api/items/:id` — delete item (owner only)
- `/auth/google` — login/register with Google

After successful Google registration, a welcome email is sent to the Google email address.

Uploads are stored in `public/uploads` and served at `/uploads/<filename>`.

