/**
 * db.js — TinyWorld Daycare Discovery
 * PRODUCTION VERSION: All functions use fetch() to talk to the Node.js backend,
 * which then talks to PostgreSQL. localStorage is gone completely.
 *
 * Every function is async now — it waits for the server to respond
 * before returning data. app.js calls these with await.
 */

// ─── Token helpers ────────────────────────────────────────────────────────────
// After login/signup the server gives us a JWT token.
// We save it in localStorage (just the token string, not any data).
// Every protected request sends it in the Authorization header.

function saveToken(token) { localStorage.setItem('tw_token', token); }
function getToken()       { return localStorage.getItem('tw_token'); }
function clearToken()     { localStorage.removeItem('tw_token'); }

// ─── Base fetch helper ────────────────────────────────────────────────────────
// All our API calls go through this one function.
// It automatically adds the token header when we have one.

async function apiFetch(url, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data     = await response.json();

  if (response.status === 401) {
    clearToken();
    return { error: 'Session expired. Please log in again.' };
  }

  return data;
}

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════

// ── BEFORE (localStorage version) ──────────────────────────────
// function signupUser(name, email, password, role) {
//   const users = JSON.parse(localStorage.getItem('tw_users') || '[]');
//   if (users.find(u => u.email === email)) return { error: 'Email already registered.' };
//   const user = { id: Date.now(), name, email, password, role };
//   users.push(user);
//   localStorage.setItem('tw_users', JSON.stringify(users));
//   return { user };
// }

// ── AFTER (fetch version) ───────────────────────────────────────
async function signupUser(name, email, password, role) {
  const result = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role }),
  });
  if (result.token) saveToken(result.token);
  return result;
}

// ── BEFORE ──────────────────────────────────────────────────────
// function loginUser(email, password, role) {
//   const users = JSON.parse(localStorage.getItem('tw_users') || '[]');
//   const user  = users.find(u => u.email===email && u.password===password && u.role===role);
//   if (!user) return { error: 'Invalid email, password, or role.' };
//   return { user };
// }

// ── AFTER ────────────────────────────────────────────────────────
async function loginUser(email, password, role) {
  const result = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
  });
  if (result.token) saveToken(result.token);
  return result;
}

// ════════════════════════════════════════════════════════════════
// DAYCARES
// ════════════════════════════════════════════════════════════════

// ── BEFORE ──────────────────────────────────────────────────────
// function getDaycares({ type, age, maxCost, minRating, q } = {}) {
//   let rows = JSON.parse(localStorage.getItem('tw_daycares'));
//   if (type && type !== 'all') rows = rows.filter(d => d.type === type);
//   if (maxCost)   rows = rows.filter(d => d.cost <= Number(maxCost));
//   if (minRating) rows = rows.filter(d => d.rating >= Number(minRating));
//   return rows;
// }

// ── AFTER ────────────────────────────────────────────────────────
async function getDaycares(filters = {}) {
  const params = new URLSearchParams();
  if (filters.type      && filters.type      !== 'all') params.set('type',      filters.type);
  if (filters.age       && filters.age       !== 'all') params.set('age',       filters.age);
  if (filters.maxCost)                                   params.set('maxCost',   filters.maxCost);
  if (filters.minRating && filters.minRating > 0)        params.set('minRating', filters.minRating);
  if (filters.q)                                         params.set('q',         filters.q);

  const result = await apiFetch(`/api/daycares?${params.toString()}`);
  return Array.isArray(result) ? result : [];
}

// ── BEFORE ──────────────────────────────────────────────────────
// function getDaycareById(id) {
//   return JSON.parse(localStorage.getItem('tw_daycares')).find(d => d.id === id);
// }

// ── AFTER ────────────────────────────────────────────────────────
async function getDaycareById(id) {
  const result = await apiFetch(`/api/daycares/${id}`);
  return result.error ? null : result;
}

// ════════════════════════════════════════════════════════════════
// LISTINGS
// ════════════════════════════════════════════════════════════════

// ── BEFORE ──────────────────────────────────────────────────────
// function getListings(daycareId) {
//   return JSON.parse(localStorage.getItem('tw_listings')).filter(l => l.daycare_id === daycareId);
// }

// ── AFTER ────────────────────────────────────────────────────────
async function getListings(daycareId) {
  const result = await apiFetch(`/api/listings?daycare_id=${daycareId}`);
  return Array.isArray(result) ? result : [];
}

// ── BEFORE ──────────────────────────────────────────────────────
// function saveListing(listing) {
//   const rows = JSON.parse(localStorage.getItem('tw_listings'));
//   if (listing.id) { /* update in array */ } else { rows.push(listing); }
//   localStorage.setItem('tw_listings', JSON.stringify(rows));
//   return listing;
// }

// ── AFTER ────────────────────────────────────────────────────────
async function saveListing(listing) {
  if (listing.id) {
    return await apiFetch(`/api/listings/${listing.id}`, {
      method: 'PUT',
      body:   JSON.stringify(listing),
    });
  } else {
    return await apiFetch('/api/listings', {
      method: 'POST',
      body:   JSON.stringify(listing),
    });
  }
}

// ── BEFORE ──────────────────────────────────────────────────────
// function deleteListing(id) {
//   const rows = JSON.parse(...).filter(l => l.id !== id);
//   localStorage.setItem('tw_listings', JSON.stringify(rows));
// }

// ── AFTER ────────────────────────────────────────────────────────
async function deleteListing(id) {
  await apiFetch(`/api/listings/${id}`, { method: 'DELETE' });
}

// ════════════════════════════════════════════════════════════════
// CHILDREN
// ════════════════════════════════════════════════════════════════

// ── BEFORE ──────────────────────────────────────────────────────
// function getChildren(daycareId) {
//   return JSON.parse(localStorage.getItem('tw_children')).filter(c => c.daycare_id === daycareId);
// }

// ── AFTER ────────────────────────────────────────────────────────
async function getChildren(daycareId) {
  const result = await apiFetch(`/api/children?daycare_id=${daycareId}`);
  return Array.isArray(result) ? result : [];
}

// ── BEFORE ──────────────────────────────────────────────────────
// function saveChild(child) {
//   const rows = JSON.parse(localStorage.getItem('tw_children'));
//   rows.push(child);
//   localStorage.setItem('tw_children', JSON.stringify(rows));
//   return child;
// }

// ── AFTER ────────────────────────────────────────────────────────
async function saveChild(child) {
  return await apiFetch('/api/children', {
    method: 'POST',
    body:   JSON.stringify(child),
  });
}

// ════════════════════════════════════════════════════════════════
// INQUIRIES
// ════════════════════════════════════════════════════════════════

// ── BEFORE ──────────────────────────────────────────────────────
// function getInquiries(daycareId) {
//   return JSON.parse(localStorage.getItem('tw_inquiries')).filter(i => i.daycare_id === daycareId);
// }

// ── AFTER ────────────────────────────────────────────────────────
async function getInquiries(daycareId) {
  const result = await apiFetch(`/api/inquiries?daycare_id=${daycareId}`);
  return Array.isArray(result) ? result : [];
}

// ── BEFORE ──────────────────────────────────────────────────────
// function saveInquiry(inquiry) {
//   const rows = JSON.parse(localStorage.getItem('tw_inquiries'));
//   rows.push(inquiry);
//   localStorage.setItem('tw_inquiries', JSON.stringify(rows));
//   return inquiry;
// }

// ── AFTER ────────────────────────────────────────────────────────
async function saveInquiry(inquiry) {
  return await apiFetch('/api/inquiries', {
    method: 'POST',
    body:   JSON.stringify(inquiry),
  });
}

// ── BEFORE ──────────────────────────────────────────────────────
// function markInquiryReplied(id) {
//   const rows = JSON.parse(localStorage.getItem('tw_inquiries'));
//   rows.find(r => r.id === id).status = 'replied';
//   localStorage.setItem('tw_inquiries', JSON.stringify(rows));
// }

// ── AFTER ────────────────────────────────────────────────────────
async function markInquiryReplied(id) {
  await apiFetch(`/api/inquiries/${id}/reply`, { method: 'PATCH' });
}

// ─── Export as DB object (same shape as before — app.js barely changes) ───────
const DB = {
  signupUser,
  loginUser,
  getDaycares,
  getDaycareById,
  getListings,
  saveListing,
  deleteListing,
  getChildren,
  saveChild,
  getInquiries,
  saveInquiry,
  markInquiryReplied,
};
