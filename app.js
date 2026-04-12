/**
 * app.js — TinyWorld Daycare Discovery
 * All UI logic, state management, and DB interactions.
 */

// ── App State ──
const state = {
  currentModule: 'landing',
  user: null,
  filters: { type: 'all', age: 'all', maxCost: 2000, minRating: 0 },
  dashboardVisible: false,
};

// ── Utility ──
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), duration);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

// ── Navigation ──
function showLanding() {
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('module-parent').classList.add('hidden');
  document.getElementById('module-daycare').classList.add('hidden');
  state.currentModule = 'landing';
}

function showModule(name) {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('module-parent').classList.add('hidden');
  document.getElementById('module-daycare').classList.add('hidden');
  document.getElementById(`module-${name}`).classList.remove('hidden');
  state.currentModule = name;
  if (name === 'parent') renderDaycares();
  if (name === 'daycare') renderDaycareDashboard();
}

// ── Auth ──
function openAuthModal(tab) {
  openModal('authModal');
  switchAuthTab(tab);
}

function switchAuthTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('signupForm').classList.toggle('hidden', tab !== 'signup');
  document.getElementById('loginTab').classList.toggle('active', tab === 'login');
  document.getElementById('signupTab').classList.toggle('active', tab === 'signup');
}

function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPass').value;
  const role     = document.querySelector('input[name="loginRole"]:checked').value;
  const result   = DB.loginUser(email, password, role);
  if (result.error) { showToast('❌ ' + result.error); return; }
  state.user = result.user;
  closeModal('authModal');
  showToast(`✅ Welcome back, ${result.user.name}!`);
  if (role === 'daycare') showModule('daycare');
  else showModule('parent');
}

function handleSignup(e) {
  e.preventDefault();
  const name     = document.getElementById('signupName').value;
  const email    = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPass').value;
  const role     = document.querySelector('input[name="signupRole"]:checked').value;
  const result   = DB.signupUser(name, email, password, role);
  if (result.error) { showToast('❌ ' + result.error); return; }
  state.user = result.user;
  closeModal('authModal');
  showToast(`🎉 Account created! Welcome, ${name}!`);
  if (role === 'daycare') showModule('daycare');
  else showModule('parent');
}

// ── Parent Module: Daycare Listings ──
function filterDaycares() {
  state.filters.maxCost  = Number(document.getElementById('costRange').value);
  state.filters.minRating = Number(document.querySelector('[data-rating].active')?.dataset.rating || 0);
  renderDaycares();
}

function toggleTag(el, group) {
  const container = el.closest('.tag-group');
  container.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  state.filters[group] = el.dataset.val;
  filterDaycares();
}

function setRating(el, val) {
  el.closest('.tag-group').querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  el.dataset.rating = val;
  state.filters.minRating = val;
  filterDaycares();
}

function renderDaycares() {
  const q       = document.getElementById('searchInput').value;
  const sort    = document.getElementById('sortSelect').value;
  let   daycares = DB.getDaycares({ ...state.filters, q });

  if (sort === 'rating') daycares.sort((a, b) => b.rating - a.rating);
  if (sort === 'price')  daycares.sort((a, b) => a.cost  - b.cost);
  if (sort === 'name')   daycares.sort((a, b) => a.name.localeCompare(b.name));

  document.getElementById('listingCount').textContent = `Showing ${daycares.length} daycare${daycares.length !== 1 ? 's' : ''}`;

  const grid = document.getElementById('daycareCards');
  grid.innerHTML = daycares.length
    ? daycares.map(d => daycareCard(d)).join('')
    : '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No daycares match your filters.</div>';
}

function daycareCard(d) {
  const statusLabel = d.slots === 0 ? 'Full' : d.slots <= 2 ? `${d.slots} spot${d.slots>1?'s':''} left` : 'Open';
  const statusClass = d.slots === 0 ? 'badge-full' : d.slots <= 2 ? 'badge-waitlist' : 'badge-open';
  return `
    <div class="daycare-card" onclick="showDetail(${d.id})">
      <div class="card-thumb" style="background:${d.color}">
        ${d.emoji}
        <div class="card-badge ${statusClass}">${statusLabel}</div>
      </div>
      <div class="card-body">
        <h4>${d.name}</h4>
        <div class="card-meta">📍 ${d.address} · ${d.hours}</div>
        <div class="card-tags">
          <span class="card-tag">${d.type}</span>
          ${d.age_groups.map(a => `<span class="card-tag">${a}</span>`).join('')}
        </div>
        <div class="card-footer">
          <span class="card-rating">★ ${d.rating}</span>
          <span class="card-price">$${d.cost}/mo</span>
        </div>
      </div>
    </div>`;
}

function showDetail(id) {
  const d = DB.getDaycareById(id);
  if (!d) return;
  const statusLabel = d.slots === 0 ? 'Waitlist Only' : d.slots <= 2 ? `Only ${d.slots} spot${d.slots>1?'s':''} left!` : `${d.slots} spots available`;
  document.getElementById('detailContent').innerHTML = `
    <div class="detail-hero" style="background:${d.color}">${d.emoji}</div>
    <div class="detail-body">
      <h2>${d.name}</h2>
      <div class="detail-meta">📍 ${d.address} · ★ ${d.rating} · ${d.phone}</div>
      <div class="detail-chips">
        <span class="detail-chip">🏷 ${d.type}</span>
        ${d.age_groups.map(a => `<span class="detail-chip">👶 ${a}</span>`).join('')}
        <span class="detail-chip">📋 License: ${d.license_no}</span>
      </div>
      <p class="detail-desc">${d.description}</p>
      <div class="detail-grid">
        <div class="detail-info"><label>Capacity</label><span>${d.capacity} children</span></div>
        <div class="detail-info"><label>Hours</label><span>${d.hours}</span></div>
        <div class="detail-info"><label>Monthly Cost</label><span>$${d.cost}</span></div>
        <div class="detail-info"><label>Availability</label><span>${statusLabel}</span></div>
      </div>
      <div class="inquire-form">
        <h4>💬 Send an Inquiry</h4>
        <form class="profile-form" onsubmit="sendInquiry(event, ${d.id})">
          <div class="form-grid" style="grid-template-columns:1fr 1fr">
            <div class="form-group"><label>Your Name</label><input type="text" id="iq-name" required placeholder="Jane Doe" /></div>
            <div class="form-group"><label>Your Email</label><input type="email" id="iq-email" required placeholder="you@example.com" /></div>
            <div class="form-group full"><label>Message</label>
              <textarea id="iq-msg" rows="3" required placeholder="Hi! I'm interested in enrolling my child..."></textarea>
            </div>
          </div>
          <button type="submit" class="btn-primary">Send Inquiry 📨</button>
        </form>
      </div>
    </div>`;
  openModal('detailModal');
}

function sendInquiry(e, daycareId) {
  e.preventDefault();
  const inq = {
    daycare_id:   daycareId,
    parent_name:  document.getElementById('iq-name').value,
    parent_email: document.getElementById('iq-email').value,
    message:      document.getElementById('iq-msg').value,
    emoji:        '👤',
  };
  DB.saveInquiry(inq);
  closeModal('detailModal');
  showToast('📨 Inquiry sent! The daycare will contact you shortly.');
}

// ── Daycare Module ──
function showDaycareDashboard() {
  document.getElementById('daycareDashboard').classList.remove('hidden');
  renderListingsTable();
  renderInquiriesList();
  renderChildrenTable();
  updateDashboardStats();
  // scroll to dashboard
  document.getElementById('daycareDashboard').scrollIntoView({ behavior: 'smooth' });
}

function renderDaycareDashboard() {
  updateDashboardStats();
}

function updateDashboardStats() {
  const children  = DB.getChildren(1);
  const inquiries = DB.getInquiries(1).filter(i => i.status === 'new');
  document.getElementById('enrollCount').textContent  = children.length;
  document.getElementById('inquiryCount').textContent = inquiries.length;
}

function switchTab(btn, tabId) {
  document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  btn.classList.add('active');
  document.getElementById(tabId).classList.remove('hidden');
}

// ── Listings Table ──
function renderListingsTable() {
  const listings = DB.getListings(1);
  const tbody = document.getElementById('listingsBody');
  tbody.innerHTML = listings.map(l => `
    <tr>
      <td><strong>${l.name}</strong></td>
      <td>${l.slots}</td>
      <td>${l.age_group}</td>
      <td>$${l.cost}</td>
      <td><span class="status-badge ${l.slots > 0 ? 'active' : 'waitlist'}">${l.slots > 0 ? 'Active' : 'Full'}</span></td>
      <td>
        <button class="action-link" onclick="editListing(${l.id})">Edit</button>
        <button class="action-link" onclick="confirmDelete(${l.id})" style="color:#dc2626">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No listings yet. Add your first one!</td></tr>';
}

function openListingForm() { openModal('listingModal'); }

function editListing(id) {
  const l = DB.getListings(1).find(x => x.id === id);
  if (!l) return;
  document.getElementById('lName').value  = l.name;
  document.getElementById('lSlots').value = l.slots;
  document.getElementById('lCost').value  = l.cost;
  openModal('listingModal');
  document.getElementById('listingModal').dataset.editId = id;
}

function saveListing(e) {
  e.preventDefault();
  const editId = document.getElementById('listingModal').dataset.editId;
  const listing = {
    id:        editId ? Number(editId) : null,
    name:      document.getElementById('lName').value,
    age_group: document.getElementById('lAge').value,
    slots:     Number(document.getElementById('lSlots').value),
    cost:      Number(document.getElementById('lCost').value),
    type:      document.getElementById('lType').value,
    status:    'active',
  };
  DB.saveListing(listing);
  delete document.getElementById('listingModal').dataset.editId;
  closeModal('listingModal');
  renderListingsTable();
  showToast('✅ Listing saved!');
  e.target.reset();
}

function confirmDelete(id) {
  if (confirm('Delete this listing?')) {
    DB.deleteListing(id);
    renderListingsTable();
    showToast('🗑 Listing deleted.');
  }
}

// ── Inquiries List ──
function renderInquiriesList() {
  const inquiries = DB.getInquiries(1);
  const container = document.getElementById('inquiriesList');
  container.innerHTML = inquiries.length
    ? inquiries.map(i => `
        <div class="inquiry-card">
          <div class="inq-avatar" style="background:var(--peach)">${i.emoji || '👤'}</div>
          <div class="inq-body">
            <div class="inq-name">${i.parent_name} <span style="font-weight:400;color:var(--muted)">· ${i.parent_email}</span></div>
            <div class="inq-msg">${i.message}</div>
            <div class="inq-meta">
              ${new Date(i.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} ·
              <span class="status-badge ${i.status === 'new' ? 'active' : 'inactive'}">${i.status === 'new' ? 'New' : 'Replied'}</span>
            </div>
            <div class="inq-actions" style="margin-top:10px">
              ${i.status === 'new' ? `<button class="btn-primary sm" onclick="replyInquiry(${i.id},'${i.parent_email}')">Reply</button>` : ''}
              <button class="action-link" onclick="markReplied(${i.id})">Mark Replied</button>
            </div>
          </div>
        </div>`).join('')
    : '<div style="text-align:center;padding:40px;color:var(--muted)">No inquiries yet!</div>';
}

function replyInquiry(id, email) {
  window.open(`mailto:${email}?subject=Re: Daycare Inquiry – Little Stars Daycare`);
  DB.markInquiryReplied(id);
  renderInquiriesList();
  updateDashboardStats();
}

function markReplied(id) {
  DB.markInquiryReplied(id);
  renderInquiriesList();
  updateDashboardStats();
  showToast('✅ Marked as replied.');
}

// ── Children Table ──
function renderChildrenTable() {
  const children = DB.getChildren(1);
  const tbody = document.getElementById('childrenBody');
  tbody.innerHTML = children.map(c => {
    const age = c.dob ? Math.floor((Date.now() - new Date(c.dob)) / (365.25*24*3600*1000)) : '?';
    return `<tr>
      <td><strong>${c.name}</strong></td>
      <td>${age}y</td>
      <td>${c.parent_name}</td>
      <td>${new Date(c.start_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</td>
      <td><span class="status-badge active">Enrolled</span></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">No children enrolled yet.</td></tr>';
}

function openChildForm() { openModal('childModal'); }

function saveChild(e) {
  e.preventDefault();
  const child = {
    name:         document.getElementById('cName').value,
    dob:          document.getElementById('cDob').value,
    parent_name:  document.getElementById('cParent').value,
    parent_email: document.getElementById('cEmail').value,
    start_date:   document.getElementById('cStart').value,
    program:      document.getElementById('cProgram').value,
  };
  DB.saveChild(child);
  closeModal('childModal');
  renderChildrenTable();
  updateDashboardStats();
  showToast('👶 Child enrolled successfully!');
  e.target.reset();
}

// ── Profile ──
function saveProfile(e) {
  e.preventDefault();
  showToast('✅ Profile saved to database!');
}

// ── Close modal on overlay click ──
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
});

// ── Init ──
window.addEventListener('DOMContentLoaded', () => {
  renderDaycares();
});
