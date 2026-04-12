/**
 * server.js — TinyWorld Daycare Discovery
 * Node.js + Express backend that connects to PostgreSQL
 *
 * HOW TO RUN:
 * 1. npm install express pg bcrypt jsonwebtoken cors dotenv
 * 2. Create a .env file (see bottom of this file)
 * 3. node server.js
 */

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const cors     = require('cors');
const path     = require('path');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

// Serve your HTML/CSS/JS files from the same folder
app.use(express.static(path.join(__dirname)));

// ─── Middleware: verify JWT token ────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1]; // "Bearer <token>"
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // Hash password before saving
    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hash, role]
    );

    const user  = result.rows[0];
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ user, token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND role = $2',
      [email, role]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email, password, or role.' });
    }

    const user       = result.rows[0];
    const passMatch  = await bcrypt.compare(password, user.password);
    if (!passMatch) return res.status(401).json({ error: 'Invalid email, password, or role.' });

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token    = jwt.sign(safeUser, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ user: safeUser, token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ════════════════════════════════════════════════════════════════
// DAYCARES ROUTES
// ════════════════════════════════════════════════════════════════

// GET /api/daycares  (with optional filters)
app.get('/api/daycares', async (req, res) => {
  const { type, age, maxCost, minRating, q } = req.query;

  let sql    = 'SELECT * FROM daycares WHERE 1=1';
  const params = [];

  if (type && type !== 'all') {
    params.push(type);
    sql += ` AND type = $${params.length}`;
  }
  if (minRating) {
    params.push(Number(minRating));
    sql += ` AND rating >= $${params.length}`;
  }
  if (maxCost) {
    params.push(Number(maxCost));
    sql += ` AND cost <= $${params.length}`;
  }
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (name ILIKE $${params.length} OR address ILIKE $${params.length})`;
  }

  sql += ' ORDER BY rating DESC';

  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch daycares.' });
  }
});

// GET /api/daycares/:id
app.get('/api/daycares/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM daycares WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daycare.' });
  }
});

// ════════════════════════════════════════════════════════════════
// LISTINGS ROUTES  (protected — must be logged in)
// ════════════════════════════════════════════════════════════════

// GET /api/listings?daycare_id=1
app.get('/api/listings', authMiddleware, async (req, res) => {
  const { daycare_id } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM listings WHERE daycare_id = $1 ORDER BY created_at DESC',
      [daycare_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listings.' });
  }
});

// POST /api/listings  — create new listing
app.post('/api/listings', authMiddleware, async (req, res) => {
  const { daycare_id, name, age_group, slots, cost, type } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO listings (daycare_id, name, age_group, slots, cost, type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [daycare_id, name, age_group, slots, cost, type]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create listing.' });
  }
});

// PUT /api/listings/:id  — update listing
app.put('/api/listings/:id', authMiddleware, async (req, res) => {
  const { name, age_group, slots, cost, type } = req.body;
  try {
    const result = await pool.query(
      'UPDATE listings SET name=$1, age_group=$2, slots=$3, cost=$4, type=$5 WHERE id=$6 RETURNING *',
      [name, age_group, slots, cost, type, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update listing.' });
  }
});

// DELETE /api/listings/:id
app.delete('/api/listings/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM listings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete listing.' });
  }
});

// ════════════════════════════════════════════════════════════════
// CHILDREN ROUTES  (protected)
// ════════════════════════════════════════════════════════════════

// GET /api/children?daycare_id=1
app.get('/api/children', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM children WHERE daycare_id = $1 ORDER BY created_at DESC',
      [req.query.daycare_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch children.' });
  }
});

// POST /api/children  — enroll a child
app.post('/api/children', authMiddleware, async (req, res) => {
  const { daycare_id, name, dob, parent_name, parent_email, start_date, program } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO children (daycare_id, name, dob, parent_name, parent_email, start_date, program) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [daycare_id, name, dob, parent_name, parent_email, start_date, program]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to enroll child.' });
  }
});

// ════════════════════════════════════════════════════════════════
// INQUIRIES ROUTES
// ════════════════════════════════════════════════════════════════

// GET /api/inquiries?daycare_id=1  (protected)
app.get('/api/inquiries', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM inquiries WHERE daycare_id = $1 ORDER BY created_at DESC',
      [req.query.daycare_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inquiries.' });
  }
});

// POST /api/inquiries  — parent sends an inquiry (public, no auth needed)
app.post('/api/inquiries', async (req, res) => {
  const { daycare_id, parent_name, parent_email, message } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO inquiries (daycare_id, parent_name, parent_email, message) VALUES ($1,$2,$3,$4) RETURNING *',
      [daycare_id, parent_name, parent_email, message]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send inquiry.' });
  }
});

// PATCH /api/inquiries/:id/reply  — mark as replied (protected)
app.patch('/api/inquiries/:id/reply', authMiddleware, async (req, res) => {
  try {
    await pool.query("UPDATE inquiries SET status='replied' WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update inquiry.' });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ TinyWorld server running at http://localhost:${PORT}`);
});

/*
─────────────────────────────────────────────────────────────────────────────
CREATE A .env FILE in the same folder with these values:
─────────────────────────────────────────────────────────────────────────────
─────────────────────────────────────────────────────────────────────────────
INSTALL DEPENDENCIES by running this in your terminal:
─────────────────────────────────────────────────────────────────────────────

npm init -y
npm install express pg bcrypt jsonwebtoken cors dotenv

─────────────────────────────────────────────────────────────────────────────
CREATE THE DATABASE by running this in psql:
─────────────────────────────────────────────────────────────────────────────

CREATE DATABASE tinyworld;
\c tinyworld

CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(180) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  role       VARCHAR(20)  NOT NULL CHECK (role IN ('parent','daycare')),
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE daycares (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(180) NOT NULL,
  address     VARCHAR(255),
  phone       VARCHAR(30),
  license_no  VARCHAR(60),
  description TEXT,
  capacity    INT DEFAULT 20,
  hours       VARCHAR(60),
  rating      NUMERIC(3,1) DEFAULT 0,
  type        VARCHAR(30),
  emoji       VARCHAR(10),
  color       VARCHAR(20),
  cost        NUMERIC(8,2),
  slots       INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE listings (
  id          SERIAL PRIMARY KEY,
  daycare_id  INT REFERENCES daycares(id) ON DELETE CASCADE,
  name        VARCHAR(180) NOT NULL,
  age_group   VARCHAR(60),
  slots       INT DEFAULT 0,
  cost        NUMERIC(8,2),
  type        VARCHAR(30),
  status      VARCHAR(20) DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE children (
  id           SERIAL PRIMARY KEY,
  daycare_id   INT REFERENCES daycares(id) ON DELETE SET NULL,
  name         VARCHAR(120) NOT NULL,
  dob          DATE,
  parent_name  VARCHAR(120),
  parent_email VARCHAR(180),
  start_date   DATE,
  program      VARCHAR(120),
  status       VARCHAR(20) DEFAULT 'enrolled',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inquiries (
  id           SERIAL PRIMARY KEY,
  daycare_id   INT REFERENCES daycares(id) ON DELETE CASCADE,
  parent_name  VARCHAR(120),
  parent_email VARCHAR(180),
  message      TEXT,
  status       VARCHAR(20) DEFAULT 'new',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
*/
