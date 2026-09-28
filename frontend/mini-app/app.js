/**
 * Telegram Mini App — Form Retur Barang
 * app.js — Main SPA logic
 *
 * Flow:
 * 1. List Retur Hari Ini (Filter Date, Status, Print, Role Simulator)
 * 2. Buat Retur Baru (Step 1: Faktur -> Step 2: Barang -> Step 3: Foto & GPS -> Step 4: Review & Kirim)
 * 3. Input / Edit Detail Retur yang sudah ada (Multi-UOM, Good/Bad Split, Cetak Struk, Approve/Reject)
 */

// ──────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────
const BASE_URL = window.location.origin;
const API      = `${BASE_URL}/api/mini-app`;

// ──────────────────────────────────────────────────
// Telegram WebApp SDK
// ──────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  try {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
  } catch (e) {
    console.warn('Telegram WebApp SDK ready error:', e);
  }
}

// ──────────────────────────────────────────────────
// Theme Management (Dark / Light Mode)
// ──────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('app_theme');
  let theme = saved;
  if (!theme) {
    if (tg && tg.colorScheme) {
      theme = tg.colorScheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    } else {
      theme = 'light';
    }
  }
  applyTheme(theme, false);
}

function applyTheme(theme, save = true) {
  const targetTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', targetTheme);
  if (save) {
    localStorage.setItem('app_theme', targetTheme);
  }

  try {
    if (tg?.setHeaderColor) {
      tg.setHeaderColor(targetTheme === 'dark' ? '#151722' : '#f8fafc');
    }
    if (tg?.setBackgroundColor) {
      tg.setBackgroundColor(targetTheme === 'dark' ? '#151722' : '#f8fafc');
    }
  } catch (e) {}

  const isDark = targetTheme === 'dark';
  const icon = isDark ? '☀️' : '🌙';
  const label = isDark ? 'Mode Terang' : 'Mode Gelap';

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.innerHTML = `<span class="theme-icon">${icon}</span>`;
    btn.setAttribute('title', `Ubah ke ${label}`);
    btn.setAttribute('aria-label', `Ubah ke ${label}`);
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
}

// Global click handler for any .theme-toggle-btn
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-toggle-btn');
  if (btn) {
    e.preventDefault();
    toggleTheme();
  }
});

// Auto-sync if Telegram theme changes and user hasn't explicitly set preference
if (tg && typeof tg.onEvent === 'function') {
  tg.onEvent('themeChanged', () => {
    if (!localStorage.getItem('app_theme') && tg.colorScheme) {
      applyTheme(tg.colorScheme, false);
    }
  });
}

initTheme();

// ──────────────────────────────────────────────────
// App State
// ──────────────────────────────────────────────────
const state = {
  sessionId:       '',
  initData:        tg?.initData || '',
  telegramUser:    tg?.initDataUnsafe?.user || {},
  mode:            '',
  returnId:        null,
  status:          'DRAFT',
  items:           [], // [{ id, productCode, productName, uom, konversi, qty, qtyGood, qtyBad, alasan }]
  
  alasanPreset:    [],
  kodeSales:       '',
  salesList:       [],
  availableStores: [],

  selectedSalespersonCode: '',
  selectedSalespersonName: '',
  returnDoc:       null,

  simulatedRole:   '',
  contactName:     '',
};

// Edit modal state
const modal = {
  editProductCode: null,
  selectedProduct: null,
  selectedAlasan:  '',
};

// Create flow state for Photo & Location
let currentPhotoUrl = '';
let currentGeoLocation = null;

// Driver pickup state for Photo & Location & Return Type
let driverPhotoUrl = null;
let driverGeoLocation = null;
let editingReturnType = null;

// ──────────────────────────────────────────────────
// DOM Helpers
// ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const showScreen = id => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $(id);
  if (el) el.classList.add('active');
};

const showError = msg => {
  const errEl = $('error-message');
  if (errEl) errEl.textContent = msg;
  showScreen('screen-error');
};

function updateProgressBar(step) {
  const bar = $('progress-bar');
  if (bar) bar.style.width = `${step * 25}%`;
  document.querySelectorAll('.step-label').forEach(lbl => {
    const s = parseInt(lbl.dataset.step) || 1;
    lbl.classList.toggle('active', s === step);
  });
}

// ──────────────────────────────────────────────────
// API helper
// ──────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-telegram-init-data': state.initData,
    'x-telegram-session-id': state.sessionId,
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request gagal');
  }
  return res.json();
}

// ──────────────────────────────────────────────────
// Init — Parse URL params & load session
// ──────────────────────────────────────────────────
async function init() {
  try {
    const params = new URLSearchParams(window.location.search);
    state.mode = params.get('mode') || '';
    state.sessionId = params.get('sessionId') || '';
    const invoiceParam = params.get('invoice') || '';
    const customerCodeParam = params.get('customerCode') || '';

    // Load config (alasan preset) — no auth needed
    try {
      const cfg = await fetch(`${API}/config`).then(r => r.json());
      state.alasanPreset = cfg.alasanPreset || [];
    } catch (e) {
      console.warn('Failed to load config:', e);
      state.alasanPreset = ['Barang rusak / cacat', 'Barang kadaluarsa', 'Salah kirim / tidak sesuai pesanan', 'Kemasan rusak', 'Lainnya'];
    }

    // Fetch session — don't force simulatedRole so backend detects real contact role
    try {
      const devParam = params.get('dev') || '';
      const explicitRoleParam = params.get('role') || '';
      let sessionUrl = `/session?invoice=${encodeURIComponent(invoiceParam)}&customerCode=${encodeURIComponent(customerCodeParam)}`;
      if (explicitRoleParam) sessionUrl += `&simulatedRole=${encodeURIComponent(explicitRoleParam)}`;
      if (devParam) sessionUrl += `&dev=${encodeURIComponent(devParam)}`;

      const sessionData = await apiFetch(sessionUrl);
      state.kodeSales = sessionData.kodeSales || '';
      state.salesList = sessionData.salesList || [];
      state.contactName = sessionData.contactName || sessionData.user?.first_name || '';
      if (sessionData.role) {
        state.simulatedRole = sessionData.role;
      } else {
        state.simulatedRole = 'Salesman';
      }
    } catch (err) {
      console.warn('Failed to load session:', err);
      if (!state.simulatedRole) state.simulatedRole = 'Salesman';
      if (!state.kodeSales) state.kodeSales = 'SBB103:ABB103';
    }

    // Role simulator & badge setup
    const isDev = params.get('dev') === 'true' || params.get('sim') === 'true';
    const roleSim = $('role-simulator');
    if (roleSim) {
      roleSim.style.display = isDev ? 'inline-block' : 'none';
    }

    // Apply role defaults to UI automatically
    applyRoleToUI(state.simulatedRole, true);

    const filterDateInput = $('filter-date');
    const filterPrintEl = $('filter-print');

    currentDateFilter = 'ALL';
    if (filterDateInput) filterDateInput.value = '';
    if (filterPrintEl) currentPrintFilter = filterPrintEl.value || 'BELUM_DICETAK';

    // Check if directly opening create flow via params or mode
    if (state.mode === 'create' || invoiceParam || customerCodeParam) {
      initCreateReturn({ invoice: invoiceParam, customerCode: customerCodeParam });
    } else {
      // Default: show returns list
      await loadListToday();
    }
  } catch (err) {
    console.error('[Init]', err);
    showError(err.message || 'Gagal memuat sesi.');
  }
}

function applyRoleToUI(role, isInitial = false) {
  state.simulatedRole = role || 'Salesman';

  // 1. Toggle + Buat Retur button (only Salesman can create returns)
  toggleCreateButtonForRole();

  // 2. Set default status filter based on role if initial load
  const fStatus = $('filter-status');
  if (isInitial) {
    if (state.simulatedRole === 'Supervisor Sales') {
      currentStatusFilter = 'SUBMITTED';
      if (fStatus) fStatus.value = 'SUBMITTED';
    } else if (state.simulatedRole === 'Driver/Kenek' || state.simulatedRole === 'Sopir') {
      currentStatusFilter = 'SPV_APPROVED';
      if (fStatus) fStatus.value = 'SPV_APPROVED';
    } else if (state.simulatedRole === 'Admin Gudang') {
      currentStatusFilter = 'DRIVER_PROCESSED';
      if (fStatus) fStatus.value = 'DRIVER_PROCESSED';
    } else {
      currentStatusFilter = 'ALL';
      if (fStatus) fStatus.value = 'ALL';
    }
  }

  // 3. Update User & Role Badge
  updateRoleBadge(state.simulatedRole);

  // 4. Sync dropdown simulator (if in dev mode)
  const roleSim = $('role-simulator');
  if (roleSim) {
    roleSim.value = state.simulatedRole;
  }
}

function updateRoleBadge(role) {
  const badge = $('user-role-badge');
  if (!badge) return;

  let label = 'Salesman';
  let icon = '👤';
  if (role === 'Supervisor Sales') {
    label = 'SPV';
    icon = '👑';
  } else if (role === 'Driver/Kenek' || role === 'Sopir') {
    label = 'Driver';
    icon = '🚚';
  } else if (role === 'Admin Gudang') {
    label = 'Gudang';
    icon = '📦';
  }

  const nameDisplay = state.contactName ? `${state.contactName} (${label})` : `Role: ${label}`;
  badge.innerHTML = `${icon} ${escHtml(nameDisplay)}`;
  badge.style.display = 'inline-flex';
  badge.title = `Login sebagai: ${role}${state.contactName ? ' (' + state.contactName + ')' : ''}`;
}

function toggleCreateButtonForRole() {
  const btnCreate = $('btn-create-return');
  if (btnCreate) {
    btnCreate.style.display = (state.simulatedRole === 'Salesman') ? '' : 'none';
  }
}

// ──────────────────────────────────────────────────
// List Returns
// ──────────────────────────────────────────────────
let allReturnsToday = [];
let currentPrintFilter = 'BELUM_DICETAK';
let currentStatusFilter = 'ALL';

const now = new Date();
const offset = now.getTimezoneOffset();
const localDate = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
let currentDateFilter = 'ALL';

function getStatusBadge(status) {
  const s = status || 'DRAFT';
  if (s === 'SUBMITTED') return '<span class="badge-status badge-submitted">⏳ Menunggu SPV</span>';
  if (s === 'SPV_APPROVED') return '<span class="badge-status badge-approved">✅ Disetujui SPV</span>';
  if (s === 'SPV_REJECTED') return '<span class="badge-status badge-rejected">❌ Ditolak SPV</span>';
  if (s === 'DRIVER_PROCESSED') return '<span class="badge-status badge-driver-processed">🚚 Sudah Ditarik Driver</span>';
  if (s === 'SELESAI') return '<span class="badge-status badge-selesai">🔒 Selesai (Gudang)</span>';
  return `<span class="badge-status badge-draft">${escHtml(s)}</span>`;
}

async function loadListToday() {
  try {
    const data = await apiFetch(`/retur/role?role=${encodeURIComponent(state.simulatedRole)}&status=${encodeURIComponent(currentStatusFilter)}&date=${encodeURIComponent(currentDateFilter)}`);
    allReturnsToday = data.data || [];
    renderReturnsList();
    showScreen('screen-list');
  } catch (err) {
    showError('Gagal memuat daftar retur: ' + err.message);
  }
}

function renderReturnsList() {
  const container = $('returns-list-container');
  if (!container) return;

  const returns = allReturnsToday.filter(r => {
    let printPass = true;
    if (currentPrintFilter === 'BELUM_DICETAK') {
      printPass = !r.isPrinted;
    } else if (currentPrintFilter === 'SUDAH_DICETAK') {
      printPass = !!r.isPrinted;
    }
    
    let statusPass = true;
    if (currentStatusFilter !== 'ALL') {
      if (currentStatusFilter === 'SUBMITTED') {
        statusPass = (r.status === 'SUBMITTED' || r.status === 'DRAFT');
      } else {
        statusPass = (r.status === currentStatusFilter);
      }
    }

    return printPass && statusPass;
  });
  
  if (returns.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:24px 12px;color:var(--tg-hint);font-size:13px">Tidak ada data retur.</div>`;
  } else {
    container.innerHTML = returns.map(r => {
      let actions = '';
      const isApproved = (r.status === 'SPV_APPROVED' || r.status === 'SELESAI' || r.status === 'DRIVER_PROCESSED');
      
      if (state.simulatedRole === 'Salesman') {
        if (isApproved) {
          actions = `
            <button class="btn btn-outline btn-sm" onclick="selectReturn('${r.id}')">Lihat Detail</button>
            <button class="btn btn-primary btn-sm" onclick="openReceiptModal('${r.id}')">🖨️ Struk</button>
          `;
        } else if (r.status === 'SPV_REJECTED') {
          actions = `
            <button class="btn btn-outline btn-sm" onclick="selectReturn('${r.id}')">Lihat Detail</button>
            <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="deleteReturnData('${r.id}')">Hapus</button>
          `;
        } else {
          actions = `
            <button class="btn btn-primary btn-sm" onclick="selectReturn('${r.id}')">Edit Detail</button>
            <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="deleteReturnData('${r.id}')">Hapus</button>
          `;
        }
      } else if (state.simulatedRole === 'Supervisor Sales') {
        if (!isApproved && r.status !== 'SPV_REJECTED') {
          actions = `
            <button class="btn btn-primary btn-sm" onclick="selectReturn('${r.id}')">Cek & Edit</button>
            <button class="btn btn-success btn-sm" onclick="approveReturn('${r.id}')">Approve</button>
            <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="rejectReturn('${r.id}')">Reject</button>
          `;
        } else {
          actions = `
            <button class="btn btn-outline btn-sm" onclick="selectReturn('${r.id}')">Lihat Detail</button>
            ${(r.status === 'SPV_APPROVED' || r.status === 'DRIVER_PROCESSED' || r.status === 'SELESAI') ? `<button class="btn btn-primary btn-sm" onclick="openReceiptModal('${r.id}')">🖨️ Struk</button>` : ''}
          `;
        }
      } else if (state.simulatedRole === 'Driver/Kenek' || state.simulatedRole === 'Sopir') {
        if (r.status === 'SPV_APPROVED') {
          actions = `
            <button class="btn btn-primary btn-sm" onclick="selectReturn('${r.id}')">🚚 Tarik & Edit</button>
            <button class="btn btn-outline btn-sm" onclick="openReceiptModal('${r.id}')">🖨️ Cetak Struk</button>
          `;
        } else if (r.status === 'DRIVER_PROCESSED' || r.status === 'SELESAI') {
          actions = `
            <button class="btn btn-outline btn-sm" onclick="selectReturn('${r.id}')">Lihat Detail</button>
            <button class="btn btn-primary btn-sm" onclick="openReceiptModal('${r.id}')">🖨️ Cetak Struk</button>
          `;
        } else {
          actions = `
            <button class="btn btn-outline btn-sm" onclick="selectReturn('${r.id}')">Lihat Detail</button>
          `;
        }
      } else if (state.simulatedRole === 'Admin Gudang') {
        if (r.status === 'DRIVER_PROCESSED') {
          actions = `
            <button class="btn btn-primary btn-sm" onclick="selectReturn('${r.id}')">📦 Terima & Cek</button>
            <button class="btn btn-outline btn-sm" onclick="openReceiptModal('${r.id}')">🖨️ Struk</button>
          `;
        } else if (r.status === 'SPV_APPROVED') {
          actions = `
            <button class="btn btn-warning btn-sm" style="background:#d97706;border-color:#d97706;color:#fff" onclick="selectReturn('${r.id}')">📦 Terima Langsung</button>
            <button class="btn btn-outline btn-sm" onclick="openReceiptModal('${r.id}')">🖨️ Struk</button>
          `;
        } else if (r.status === 'SELESAI') {
          actions = `
            <button class="btn btn-outline btn-sm" onclick="selectReturn('${r.id}')">Lihat Detail</button>
            <button class="btn btn-primary btn-sm" onclick="openReceiptModal('${r.id}')">🖨️ Struk Gudang</button>
          `;
        } else {
          actions = `
            <button class="btn btn-outline btn-sm" onclick="selectReturn('${r.id}')">Lihat Detail</button>
          `;
        }
      }

      let totalGood = 0;
      let totalBad = 0;
      let totalNominal = 0;
      (r.items || []).forEach(it => {
        if (!it.deletedAt) {
          totalGood += (it.qtyGood || 0);
          totalBad += (it.qtyBad || 0);
          const p = it.price !== undefined && it.price !== null ? parseFloat(it.price) : 0;
          const sub = it.totalPrice !== undefined && it.totalPrice !== null ? parseFloat(it.totalPrice) : (p * (parseFloat(it.qty) || 0));
          totalNominal += sub;
        }
      });
      let stockSummary = '';
      if (totalGood > 0 || totalBad > 0) {
        stockSummary = `<span style="margin-left:6px;font-size:11px;">(🟢 ${totalGood} Good · 🔴 ${totalBad} Bad)</span>`;
      }
      const nominalSummary = totalNominal > 0
        ? ` · <strong style="color:#55e67a">Rp ${Math.round(totalNominal).toLocaleString('id-ID')}</strong>`
        : '';

      return `
      <div class="item-card" style="margin-bottom:10px;">
        <div class="item-info">
          <div class="item-name">${escHtml(r.customerCode || '')} - ${escHtml(r.customerName || 'Toko')}</div>
          <div class="item-detail">No Retur: <strong>${escHtml(r.returnNumber || '-')}</strong> | Inv: ${escHtml(r.invoiceNumber || '-')}</div>
          <div class="item-detail">Sales: <strong>${escHtml(r.salespersonCode || '-')}</strong> | Tipe: <strong>${escHtml(r.returnType || 'TUNAI')}</strong></div>
          <div class="item-detail" style="margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span>Status: ${getStatusBadge(r.status)}</span>
            ${r.isSynced 
              ? '<span class="badge" style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);font-size:10px;padding:1px 6px;">☁️ Sinkron Pusat</span>' 
              : '<span class="badge" style="background:rgba(234,179,8,0.15);color:#eab308;border:1px solid rgba(234,179,8,0.3);font-size:10px;padding:1px 6px;">⏳ Belum Sinkron</span>'}
          </div>
          <div class="item-detail">Items: <strong>${r.items ? r.items.length : 0} SKU</strong>${nominalSummary}${stockSummary}</div>
        </div>
        <div class="item-actions" style="flex-direction:column;gap:5px;align-items:flex-end;">
          ${actions}
        </div>
      </div>
    `}).join('');
  }
}

// Filter dropdowns wiring
const filterPrintDropdown = $('filter-print');
if (filterPrintDropdown) {
  filterPrintDropdown.addEventListener('change', (e) => {
    currentPrintFilter = e.target.value;
    renderReturnsList();
  });
}

const filterStatusDropdown = $('filter-status');
if (filterStatusDropdown) {
  filterStatusDropdown.addEventListener('change', (e) => {
    currentStatusFilter = e.target.value;
    loadListToday();
  });
}

const roleSimulator = $('role-simulator');
if (roleSimulator) {
  roleSimulator.addEventListener('change', async (e) => {
    const newRole = e.target.value;
    applyRoleToUI(newRole, true);

    const fDate = $('filter-date');
    currentDateFilter = 'ALL';
    if (fDate) fDate.value = '';

    try {
      const sessionData = await apiFetch(`/session?simulatedRole=${encodeURIComponent(newRole)}&dev=true`);
      state.kodeSales = sessionData.kodeSales || '';
      state.salesList = sessionData.salesList || [];
    } catch (err) {
      console.warn('Failed to refresh session for role', err);
    }
    loadListToday();
  });
}

const filterDateInput = $('filter-date');
if (filterDateInput) {
  if (!filterDateInput.value && currentDateFilter !== 'ALL') {
    filterDateInput.value = currentDateFilter;
  }
  filterDateInput.addEventListener('change', (e) => {
    currentDateFilter = e.target.value || 'ALL';
    loadListToday();
  });
}

const btnDateAll = $('btn-date-all');
if (btnDateAll) {
  btnDateAll.addEventListener('click', () => {
    currentDateFilter = 'ALL';
    if (filterDateInput) filterDateInput.value = '';
    loadListToday();
  });
}

// ──────────────────────────────────────────────────
// Role Actions: Approve, Reject, Print Prompt
// ──────────────────────────────────────────────────
window.approveReturn = async (id) => {
  if (!confirm('Approve retur ini?')) return;
  try {
    await apiFetch(`/retur/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ role: state.simulatedRole })
    });
    alert('Retur berhasil disetujui (Approved).');
    loadListToday();
  } catch (e) {
    alert('Gagal approve: ' + e.message);
  }
};

window.rejectReturn = async (id) => {
  if (!confirm('Tolak (Reject) retur ini?')) return;
  try {
    await apiFetch(`/retur/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ role: state.simulatedRole })
    });
    alert('Retur telah ditolak (Rejected).');
    loadListToday();
  } catch (e) {
    alert('Gagal reject: ' + e.message);
  }
};

window.printReturnPrompt = (id) => {
  const choice = prompt('Pilih tipe cetak:\n1. GOOD (Good Stock / G)\n2. BAD (Bad Stock / B)\n3. BOTH (Semua)\n\nKetik GOOD, BAD, atau BOTH:', 'BOTH');
  if (!choice) return;
  const upper = choice.trim().toUpperCase();
  const printType = (upper === 'GOOD' || upper === 'BAD') ? upper : 'BOTH';
  printReturn(id, printType);
};

async function printReturn(id, printType = null) {
  try {
    const body = printType ? { printType } : {};
    await apiFetch(`/retur/${id}/print`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    alert('Struk berhasil dikirim ke antrean cetak.');
  } catch (err) {
    alert('Gagal mencetak: ' + err.message);
  }
}

// ──────────────────────────────────────────────────
// Thermal Receipt Modal & Printing
// ──────────────────────────────────────────────────
let currentReceiptId = null;
let currentReceiptType = 'ALL';

window.openReceiptModal = async (id, printType = 'ALL') => {
  currentReceiptId = id;
  currentReceiptType = printType;
  const modal = $('modal-receipt');
  const pre = $('receipt-text');
  const sub = $('receipt-modal-sub');
  if (!modal) return;

  modal.classList.remove('hidden');
  pre.textContent = '⏳ Mengambil data struk...';
  if (sub) sub.textContent = 'Memuat...';

  // Highlight active filter pill
  document.querySelectorAll('.btn-receipt-filter').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-type') === currentReceiptType);
  });

  try {
    const res = await apiFetch(`/retur/${id}/receipt?type=${encodeURIComponent(currentReceiptType)}`);
    const d = res.data;
    pre.textContent = d.plainText || 'Struk kosong';
    if (sub) {
      sub.textContent = `${d.returnNumber || '-'} · ${d.customerName || '-'}`;
    }
  } catch (err) {
    pre.textContent = 'Gagal memuat struk: ' + err.message;
  }
};

// Wiring for receipt modal
document.addEventListener('DOMContentLoaded', () => {
  wireReceiptModal();
});

function wireReceiptModal() {
  const btnReceiptClose = $('btn-receipt-close');
  const btnReceiptCancel = $('btn-receipt-cancel');
  if (btnReceiptClose) btnReceiptClose.onclick = () => $('modal-receipt')?.classList.add('hidden');
  if (btnReceiptCancel) btnReceiptCancel.onclick = () => $('modal-receipt')?.classList.add('hidden');

  document.querySelectorAll('.btn-receipt-filter').forEach(btn => {
    btn.onclick = (e) => {
      const type = e.target.getAttribute('data-type') || 'ALL';
      if (currentReceiptId) {
        window.openReceiptModal(currentReceiptId, type);
      }
    };
  });

  const btnDirectPrint = $('btn-receipt-direct-print');
  if (btnDirectPrint) {
    btnDirectPrint.onclick = () => {
      window.print();
    };
  }

  const btnOfficePrint = $('btn-receipt-office-print');
  if (btnOfficePrint) {
    btnOfficePrint.onclick = async () => {
      if (!currentReceiptId) return;
      const pType = currentReceiptType === 'ALL' ? null : currentReceiptType;
      await printReturn(currentReceiptId, pType);
    };
  }
}
wireReceiptModal();

async function deleteReturnData(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus retur ini?')) return;
  try {
    await apiFetch(`/retur/${id}`, { method: 'DELETE' });
    alert('Retur berhasil dihapus.');
    loadListToday();
  } catch (err) {
    alert('Gagal menghapus: ' + err.message);
  }
}

function resetPhotoUI() {
  currentPhotoUrl = '';
  const photoPreview = $('photo-preview');
  if (photoPreview) photoPreview.src = '';
  const photoPreviewContainer = $('photo-preview-container');
  if (photoPreviewContainer) photoPreviewContainer.classList.add('hidden');
  const photoActionBox = $('photo-action-box');
  if (photoActionBox) photoActionBox.classList.remove('hidden');
  const photoStatus = $('photo-status');
  if (photoStatus) {
    photoStatus.textContent = 'Belum ada foto';
    photoStatus.style.color = '';
  }
  const camInput = $('camera-file-input');
  if (camInput) camInput.value = '';
  const galInput = $('gallery-file-input');
  if (galInput) galInput.value = '';
}

// ──────────────────────────────────────────────────
// Create Return Flow (Steps 1, 2, 3, 4)
// ──────────────────────────────────────────────────
function initCreateReturn(prefill = {}) {
  state.returnId = null;
  state.returnDoc = null;
  state.status = 'DRAFT';
  state.items = [];
  state.selectedSalespersonCode = '';
  state.selectedSalespersonName = '';
  currentGeoLocation = null;

  // Reset photo & location
  resetPhotoUI();

  const locationDisplay = $('location-display');
  if (locationDisplay) {
    locationDisplay.classList.remove('has-location');
    locationDisplay.innerHTML = '<p class="location-hint">Belum ada lokasi (Wajib)</p>';
  }

  // Populate Kode Sales dropdown
  const selSalesCode = $('s1-sales-code');
  if (selSalesCode) {
    selSalesCode.innerHTML = '<option value="">Pilih Kode Sales...</option>';
    if (state.salesList && state.salesList.length > 0) {
      state.salesList.forEach(s => {
        const label = s.name && s.name !== s.code ? `${s.code} - ${s.name}` : s.code;
        selSalesCode.innerHTML += `<option value="${escHtml(s.code)}" data-name="${escHtml(s.name || s.code)}">${escHtml(label)}</option>`;
      });
      selSalesCode.value = state.salesList[0].code;
      state.selectedSalespersonCode = state.salesList[0].code;
      state.selectedSalespersonName = state.salesList[0].name || state.salesList[0].code;
      loadStoresForSalesCode(state.salesList[0].code, prefill.customerCode);
    } else if (state.kodeSales) {
      const codes = state.kodeSales.split(':').map(c => c.trim()).filter(Boolean);
      codes.forEach(c => {
        selSalesCode.innerHTML += `<option value="${escHtml(c)}" data-name="${escHtml(c)}">${escHtml(c)}</option>`;
      });
      if (codes.length > 0) {
        selSalesCode.value = codes[0];
        state.selectedSalespersonCode = codes[0];
        state.selectedSalespersonName = codes[0];
        loadStoresForSalesCode(codes[0], prefill.customerCode);
      }
    }
  }

  $('s1-customer').innerHTML = '<option value="">Pilih Toko...</option>';
  clearStoreSelection();
  $('s1-invoice').value = prefill.invoice || '';
  
  // Default type TUNAI
  document.querySelectorAll('#toggle-type .toggle-btn').forEach(btn => btn.classList.remove('active'));
  const btnTunai = document.querySelector('#toggle-type .toggle-btn[data-value="TUNAI"]');
  if (btnTunai) btnTunai.classList.add('active');

  $('btn-step1-next').onclick = goStep2FromCreate;

  showScreen('screen-app');
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  $('step-1').classList.add('active');
  const progHeader = document.querySelector('.progress-header');
  if (progHeader) progHeader.style.display = 'flex';
  updateProgressBar(1);
}

const btnCreateReturn = $('btn-create-return');
if (btnCreateReturn) {
  btnCreateReturn.addEventListener('click', () => initCreateReturn());
}

const selSalesCode = $('s1-sales-code');
if (selSalesCode) {
  const onSalesCodeChange = (e) => {
    const val = e.target.value;
    state.selectedSalespersonCode = val;
    const selectedOpt = selSalesCode.options[selSalesCode.selectedIndex];
    state.selectedSalespersonName = selectedOpt?.getAttribute('data-name') || val;
    if (val) loadStoresForSalesCode(val);
  };
  selSalesCode.addEventListener('change', onSalesCodeChange);
  selSalesCode.addEventListener('input', onSalesCodeChange);
}

// Toggle group (TUNAI / KREDIT)
document.querySelectorAll('#toggle-type .toggle-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#toggle-type .toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

function selectStore(store) {
  if (!store) return;
  const selCustomer = $('s1-customer');
  if (selCustomer) selCustomer.value = store.customer_code;

  $('sel-store-name').textContent = store.customer_name || store.customer_code;
  $('sel-store-code').textContent = `${store.customer_code}${store.address ? ' · ' + store.address : ''}`;

  $('store-search-input')?.classList.add('hidden');
  $('store-suggestions')?.classList.add('hidden');
  $('selected-store-display')?.classList.remove('hidden');
}

function clearStoreSelection() {
  const selCustomer = $('s1-customer');
  if (selCustomer) selCustomer.value = '';

  $('selected-store-display')?.classList.add('hidden');
  const input = $('store-search-input');
  if (input) {
    input.value = '';
    input.classList.remove('hidden');
    input.focus();
    renderStoreSuggestions('');
  }
}

function renderStoreSuggestions(query) {
  const dropdown = $('store-suggestions');
  if (!dropdown) return;
  const q = (query || '').trim().toLowerCase();

  const matched = q
    ? state.availableStores.filter(s =>
        (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
        (s.customer_code && s.customer_code.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q))
      )
    : state.availableStores;

  if (matched.length === 0) {
    dropdown.innerHTML = '<div class="suggestion-item" style="color:var(--tg-hint);cursor:default;padding:12px;text-align:center;">Toko tidak ditemukan</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  dropdown.innerHTML = matched.slice(0, 50).map(s => `
    <div class="suggestion-item store-item" data-code="${escHtml(s.customer_code)}">
      <div class="suggestion-name">${escHtml(s.customer_name || s.customer_code)}</div>
      <div class="suggestion-code" style="display:flex;gap:6px;align-items:center;margin-top:2px;">
        <span class="badge" style="font-size:10.5px;padding:1px 6px;">${escHtml(s.customer_code)}</span>
        ${s.address ? `<span style="font-size:11px;color:var(--tg-hint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${escHtml(s.address)}</span>` : ''}
      </div>
    </div>
  `).join('');

  dropdown.classList.remove('hidden');
}

// Wire store search input & dropdown events
const storeSearchInput = $('store-search-input');
if (storeSearchInput) {
  storeSearchInput.addEventListener('focus', () => {
    if (state.availableStores && state.availableStores.length > 0) {
      renderStoreSuggestions(storeSearchInput.value);
    }
  });

  storeSearchInput.addEventListener('input', (e) => {
    renderStoreSuggestions(e.target.value);
  });
}

const storeSuggestionsDropdown = $('store-suggestions');
if (storeSuggestionsDropdown) {
  storeSuggestionsDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.store-item');
    if (!item) return;
    const code = item.dataset.code;
    const store = state.availableStores.find(s => s.customer_code === code);
    if (store) {
      selectStore(store);
    }
  });
}

const btnClearStore = $('btn-clear-store');
if (btnClearStore) {
  btnClearStore.addEventListener('click', clearStoreSelection);
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.store-search-wrap')) {
    $('store-suggestions')?.classList.add('hidden');
  }
});

async function loadStoresForSalesCode(code, prefillCustomer = null) {
  const selCustomer = $('s1-customer');
  const storeInput = $('store-search-input');
  if (storeInput) {
    storeInput.value = '';
    storeInput.placeholder = 'Memuat toko...';
    storeInput.disabled = true;
    storeInput.classList.remove('hidden');
  }
  $('selected-store-display')?.classList.add('hidden');
  $('store-suggestions')?.classList.add('hidden');

  if (selCustomer) {
    selCustomer.innerHTML = '<option value="">Memuat Toko...</option>';
  }

  try {
    const res = await apiFetch(`/coverage?kodeSales=${encodeURIComponent(code)}`);
    state.availableStores = res.data || [];

    if (selCustomer) {
      selCustomer.innerHTML = '<option value="">Pilih Toko...</option>' + 
        state.availableStores.map(s => `<option value="${escHtml(s.customer_code)}">${escHtml(s.customer_name)} (${escHtml(s.customer_code)})</option>`).join('');
    }

    if (storeInput) {
      storeInput.disabled = false;
      storeInput.placeholder = state.availableStores.length > 0
        ? `Cari nama atau kode toko (${state.availableStores.length} toko)...`
        : 'Tidak ada toko untuk kode sales ini';
    }

    if (prefillCustomer) {
      const matched = state.availableStores.find(s => s.customer_code === prefillCustomer);
      if (matched) {
        selectStore(matched);
      } else if (selCustomer) {
        selCustomer.value = prefillCustomer;
      }
    }
  } catch (err) {
    if (selCustomer) selCustomer.innerHTML = '<option value="">Gagal memuat toko</option>';
    if (storeInput) {
      storeInput.placeholder = 'Gagal memuat toko';
      storeInput.disabled = true;
    }
  }
}

function goStep2FromCreate() {
  const code = $('s1-sales-code')?.value;
  const customerCode = $('s1-customer')?.value;
  if (!code) return alert('Pilih Kode Sales terlebih dahulu.');
  if (!customerCode) return alert('Pilih Toko terlebih dahulu.');
  state.selectedSalespersonCode = code;
  const selSalesCode = $('s1-sales-code');
  if (selSalesCode && selSalesCode.selectedIndex >= 0) {
    const selectedOpt = selSalesCode.options[selSalesCode.selectedIndex];
    state.selectedSalespersonName = selectedOpt?.getAttribute('data-name') || code;
  }
  
  // Switch to step-2
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  $('step-2').classList.add('active');
  $('return-header-card')?.classList.add('hidden');
  updateProgressBar(2);
  
  // Navigation for Create flow
  $('btn-step2-back').onclick = () => {
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    $('step-1').classList.add('active');
    updateProgressBar(1);
  };
  
  const btnNext = $('btn-step2-next');
  btnNext.disabled = false;
  btnNext.textContent = 'Lanjut →';
  btnNext.style.display = '';
  btnNext.onclick = () => {
    if (state.items.length === 0) return alert('Minimal 1 barang harus dimasukkan.');
    goStep3FromCreate();
  };
  
  $('btn-step2-finish').style.display = 'none';
  $('btn-add-item').style.display = '';
  $('btn-add-item').onclick = () => openModal(-1);
  
  renderItemList();
}

function goStep3FromCreate() {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  $('step-3').classList.add('active');
  updateProgressBar(3);

  $('btn-step3-back').onclick = () => {
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    $('step-2').classList.add('active');
    updateProgressBar(2);
  };

  $('btn-step3-next').onclick = () => {
    if (!currentPhotoUrl) {
      alert('⚠️ Foto barang retur wajib dilampirkan sebelum melanjutkan ke tahap Review.');
      return;
    }
    if (!currentGeoLocation || currentGeoLocation.lat === null || currentGeoLocation.lat === undefined || currentGeoLocation.lng === null || currentGeoLocation.lng === undefined) {
      alert('⚠️ Share location (GPS) wajib diambil sebelum melanjutkan. Silakan klik tombol "📍 Dapatkan Lokasi GPS".');
      return;
    }
    goStep4FromCreate();
  };
}

function goStep4FromCreate() {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  $('step-4').classList.add('active');
  updateProgressBar(4);

  $('btn-step4-back').onclick = () => {
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    $('step-3').classList.add('active');
    updateProgressBar(3);
  };

  // Populate Review Details
  const selCust = $('s1-customer');
  const cCode = selCust ? selCust.value : '';
  const selectedStore = state.availableStores?.find(s => s.customer_code === cCode);
  const cName = selectedStore ? selectedStore.customer_name : (selCust?.options[selCust.selectedIndex]?.text || cCode);

  const invoiceNum = $('s1-invoice')?.value.trim() || '—';
  const activeTypeBtn = document.querySelector('#toggle-type .toggle-btn.active');
  const returnType = activeTypeBtn ? activeTypeBtn.dataset.value : 'TUNAI';

  if (cCode) {
    $('r-customer').textContent = selectedStore ? `${selectedStore.customer_name} (${cCode})` : (cName ? `${cName} (${cCode})` : cCode);
  } else {
    $('r-customer').textContent = '—';
  }

  if ($('r-salesperson')) {
    const sCode = state.selectedSalespersonCode || $('s1-sales-code')?.value || '—';
    const sName = state.selectedSalespersonName || '';
    $('r-salesperson').textContent = sName && sName !== sCode ? `${sCode} - ${sName}` : sCode;
  }

  $('r-invoice').textContent = invoiceNum;
  $('r-type').textContent = returnType;
  
  if (currentGeoLocation && currentGeoLocation.lat !== null && currentGeoLocation.lat !== undefined) {
    $('r-location').textContent = currentGeoLocation.address || `${currentGeoLocation.lat.toFixed(5)}, ${currentGeoLocation.lng.toFixed(5)}`;
    $('r-location').style.color = '';
  } else {
    $('r-location').innerHTML = '<span style="color:var(--red,#ef4444);font-weight:600;">⚠️ Belum ada lokasi (Wajib)</span>';
  }

  const rPhoto = $('r-photo');
  if (rPhoto) {
    if (currentPhotoUrl) {
      rPhoto.innerHTML = `<img src="${currentPhotoUrl}" class="review-photo-thumb" alt="Foto" /> <span style="font-size:11px;color:#55e67a;margin-left:6px;font-weight:600;">Tersedia</span>`;
    } else {
      rPhoto.innerHTML = '<span style="color:var(--red,#ef4444);font-weight:600;">⚠️ Belum ada foto (Wajib)</span>';
    }
  }

  // Render review items
  const reviewItemsContainer = $('review-items');
  const grouped = getGroupedItems().filter(g => g.uoms.some(u => !u.deletedAt && u.qty > 0));

  if (grouped.length === 0) {
    reviewItemsContainer.innerHTML = '<div style="color:var(--tg-hint);font-size:12px;padding:8px 0;">Tidak ada item barang.</div>';
  } else {
    let reviewGrandTotal = 0;
    reviewItemsContainer.innerHTML = grouped.map((g, idx) => {
      let itemSubtotal = 0;
      const activeUoms = g.uoms.filter(u => !u.deletedAt && u.qty > 0);
      activeUoms.forEach(u => {
        if (u.totalPrice) {
          itemSubtotal += u.totalPrice;
          reviewGrandTotal += u.totalPrice;
        }
      });

      const uomsHtml = activeUoms.map(u => {
        const pText = (u.price !== undefined && u.price !== null)
          ? `@ Rp ${Math.round(u.price).toLocaleString('id-ID')}`
          : '';
        const priceLine = pText ? `${escHtml(u.uom)} ${pText}` : `${escHtml(u.uom)}`;
        const badClass = (u.qtyBad || 0) > 0 ? 'has-bad' : 'zero-bad';
        const goodClass = (u.qtyGood || 0) > 0 ? 'has-good' : 'zero-good';

        return `
          <div class="review-uom-block">
            <div class="review-uom-price">${priceLine}</div>
            <div class="review-stock-row">
              <div class="review-stock-col col-good ${goodClass}">
                <span class="stock-dot">🟢</span> <span class="stock-num">${u.qtyGood || 0}</span> Good
              </div>
              <div class="review-stock-col col-bad ${badClass}">
                <span class="stock-dot">🔴</span> <span class="stock-num">${u.qtyBad || 0}</span> Bad
              </div>
              <div class="review-stock-col col-total">
                Total: <span class="stock-num-total">${u.qty}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      const subHtml = itemSubtotal > 0
        ? `<div class="review-item-subtotal"><span class="subtotal-label">Subtotal:</span> Rp ${Math.round(itemSubtotal).toLocaleString('id-ID')}</div>`
        : (itemSubtotal === 0 && activeUoms.some(u => u.price !== undefined && u.price !== null)
          ? `<div class="review-item-subtotal"><span class="subtotal-label">Subtotal:</span> Rp 0</div>`
          : '');

      return `
        <div class="review-item-card">
          <div class="review-item-title">${idx + 1}. ${escHtml(g.productName || g.productCode)}</div>
          ${uomsHtml}
          <div class="review-item-footer">
            <div class="review-item-alasan">
              <span class="alasan-label">Alasan:</span> ${escHtml(g.alasan || '—')}
            </div>
            ${subHtml}
          </div>
        </div>
      `;
    }).join('');

    if (reviewGrandTotal > 0) {
      reviewItemsContainer.innerHTML += `
        <div class="review-grand-total-card">
          <span class="grand-total-label">Total Estimasi Retur</span>
          <span class="grand-total-value">Rp ${Math.round(reviewGrandTotal).toLocaleString('id-ID')}</span>
        </div>
      `;
    }
  }

  // Submit button
  const btnSubmit = $('btn-submit');
  btnSubmit.disabled = false;
  btnSubmit.textContent = '✅ Kirim Retur';

  btnSubmit.onclick = async () => {
    if (state.items.length === 0) {
      alert('Minimal 1 barang harus dimasukkan.');
      return;
    }
    if (!currentPhotoUrl) {
      alert('⚠️ Foto barang retur wajib dilampirkan.');
      goStep3FromCreate();
      return;
    }
    if (!currentGeoLocation || currentGeoLocation.lat === null || currentGeoLocation.lat === undefined || currentGeoLocation.lng === null || currentGeoLocation.lng === undefined) {
      alert('⚠️ Share location (GPS) wajib diambil.');
      goStep3FromCreate();
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = '⏳ Mengirim Retur...';

    const payload = {
      customerCode: cCode,
      customerName: selectedStore?.customer_name || cName,
      invoiceNumber: $('s1-invoice')?.value.trim() || '',
      salespersonCode: $('s1-sales-code')?.value || state.selectedSalespersonCode || state.kodeSales,
      salespersonName: state.selectedSalespersonName || ($('s1-sales-code')?.options[$('s1-sales-code')?.selectedIndex]?.dataset?.name) || '',
      returnType: returnType,
      latitude: currentGeoLocation ? currentGeoLocation.lat : null,
      longitude: currentGeoLocation ? currentGeoLocation.lng : null,
      locationAddress: currentGeoLocation ? currentGeoLocation.address : '',
      photoUrl: currentPhotoUrl || '',
      isCustomerValid: true,
      items: state.items.filter(it => !it.deletedAt && it.qty > 0)
    };

    try {
      const result = await apiFetch('/retur/submit', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      $('success-return-number').textContent = result.returnNumber || 'Berhasil';
      document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
      $('step-success').classList.add('active');
      document.querySelector('.progress-header').style.display = 'none';

      if (tg) {
        tg.MainButton.hide();
        tg.disableClosingConfirmation();
      }

      $('btn-close').onclick = () => {
        if (tg) tg.close();
        else {
          showScreen('screen-list');
          loadListToday();
        }
      };
    } catch (err) {
      alert('Gagal mengirim retur: ' + err.message);
      btnSubmit.disabled = false;
      btnSubmit.textContent = '✅ Kirim Retur';
    }
  };
}

// ──────────────────────────────────────────────────
// Step 3: Photo Upload (Live Camera, Native Camera & Gallery)
// ──────────────────────────────────────────────────
let cameraStream = null;
let currentFacingMode = 'environment';
let isTorchOn = false;
let cameraTarget = 'sales'; // 'sales' | 'driver'

// Unified handler for uploading photo file or blob
async function handlePhotoFile(fileOrBlob, fileName = 'foto_retur.jpg') {
  if (!fileOrBlob) return;

  const photoPreview = $('photo-preview');
  const photoPreviewContainer = $('photo-preview-container');
  const photoActionBox = $('photo-action-box');
  const photoStatus = $('photo-status');
  const btnRetakeCam = $('btn-retake-camera');
  const btnRetakeGal = $('btn-retake-gallery');
  const btnRemovePhoto = $('btn-remove-photo');

  // 1. Show instant local preview
  const reader = new FileReader();
  reader.onload = (e) => {
    if (photoPreview) photoPreview.src = e.target.result;
    if (photoActionBox) photoActionBox.classList.add('hidden');
    if (photoPreviewContainer) photoPreviewContainer.classList.remove('hidden');
    if (photoStatus) {
      photoStatus.textContent = '⏳ Mengunggah foto...';
      photoStatus.style.color = '#ff9f0a';
    }
  };
  reader.readAsDataURL(fileOrBlob);

  // 2. Upload to server
  const formData = new FormData();
  formData.append('photo', fileOrBlob, fileName);

  try {
    if (btnRetakeCam) btnRetakeCam.disabled = true;
    if (btnRetakeGal) btnRetakeGal.disabled = true;
    if (btnRemovePhoto) btnRemovePhoto.disabled = true;

    const headers = {
      'x-telegram-init-data': state.initData,
      'x-telegram-session-id': state.sessionId,
    };
    const res = await fetch(`${API}/uploads/photo`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Upload gagal');
    }
    const data = await res.json();
    currentPhotoUrl = data.url;

    if (photoStatus) {
      photoStatus.textContent = '✅ Foto berhasil diunggah';
      photoStatus.style.color = '#55e67a';
    }
  } catch (err) {
    console.error('Photo upload error:', err);
    alert('Gagal mengunggah foto: ' + err.message);
    if (photoStatus) {
      photoStatus.textContent = '⚠️ Gagal diunggah. Coba lagi.';
      photoStatus.style.color = '#ff453a';
    }
  } finally {
    if (btnRetakeCam) btnRetakeCam.disabled = false;
    if (btnRetakeGal) btnRetakeGal.disabled = false;
    if (btnRemovePhoto) btnRemovePhoto.disabled = false;
  }
}

// Live Camera Functions
function updateCameraModalUI(target) {
  const titleEl = document.querySelector('#modal-camera .camera-header-title');
  const guideEl = document.querySelector('#modal-camera .vf-guide-text');
  if (target === 'driver') {
    if (titleEl) titleEl.textContent = '🚚 Kamera Penarikan Driver';
    if (guideEl) guideEl.textContent = 'Posisikan fisik barang retur yang ditarik di dalam kotak ini';
  } else {
    if (titleEl) titleEl.textContent = '📸 Kamera Faktur / Barang';
    if (guideEl) guideEl.textContent = 'Posisikan faktur / barang di dalam kotak ini';
  }
}

async function openLiveCamera(target = 'sales') {
  cameraTarget = target;
  updateCameraModalUI(target);

  const fallbackInput = (target === 'driver') ? $('driver-camera-input') : $('camera-file-input');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // Fallback directly to native camera file input
    if (fallbackInput) fallbackInput.click();
    return;
  }

  try {
    const modalCam = $('modal-camera');
    if (modalCam) modalCam.classList.remove('hidden');
    await startCameraStream(currentFacingMode);
  } catch (err) {
    console.warn('Live camera stream unavailable, fallback to native camera input:', err);
    closeCameraModal();
    if (fallbackInput) fallbackInput.click();
  }
}

async function startCameraStream(facingMode) {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  isTorchOn = false;

  const constraints = {
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    },
    audio: false
  };

  cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
  const videoEl = $('camera-video');
  if (videoEl) {
    videoEl.srcObject = cameraStream;
    await videoEl.play();
  }

  // Check torch capability
  const track = cameraStream.getVideoTracks()[0];
  const btnFlash = $('btn-camera-flash');
  if (track && track.getCapabilities && btnFlash) {
    const caps = track.getCapabilities();
    if (caps.torch) {
      btnFlash.classList.remove('hidden');
    } else {
      btnFlash.classList.add('hidden');
    }
  }
}

function closeCameraModal() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  isTorchOn = false;
  const modalCam = $('modal-camera');
  if (modalCam) modalCam.classList.add('hidden');
}

function capturePhotoFromCamera() {
  const videoEl = $('camera-video');
  if (!videoEl || !cameraStream) return;

  // Flash FX animation
  const flashFx = $('camera-flash-fx');
  if (flashFx) {
    flashFx.classList.add('flash-active');
    setTimeout(() => flashFx.classList.remove('flash-active'), 250);
  }

  const canvas = document.createElement('canvas');
  const maxDim = 1600;
  let w = videoEl.videoWidth || 1280;
  let h = videoEl.videoHeight || 720;

  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, w, h);

  canvas.toBlob((blob) => {
    closeCameraModal();
    if (blob) {
      if (cameraTarget === 'driver') {
        handleDriverPhotoFile(blob, `kamera_driver_${Date.now()}.jpg`);
      } else {
        handlePhotoFile(blob, `kamera_retur_${Date.now()}.jpg`);
      }
    }
  }, 'image/jpeg', 0.85);
}

async function toggleCameraFlip() {
  currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
  try {
    await startCameraStream(currentFacingMode);
  } catch (err) {
    console.warn('Failed to switch camera direction:', err);
  }
}

async function toggleFlashlight() {
  if (!cameraStream) return;
  const track = cameraStream.getVideoTracks()[0];
  if (!track || !track.applyConstraints) return;

  isTorchOn = !isTorchOn;
  try {
    await track.applyConstraints({ advanced: [{ torch: isTorchOn }] });
    const btnFlash = $('btn-camera-flash');
    if (btnFlash) btnFlash.style.background = isTorchOn ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
  } catch (err) {
    console.warn('Torch not supported or failed:', err);
  }
}

// Wire photo buttons
const btnOpenCam = $('btn-open-camera');
if (btnOpenCam) btnOpenCam.onclick = () => openLiveCamera('sales');

const btnRetakeCam = $('btn-retake-camera');
if (btnRetakeCam) btnRetakeCam.onclick = () => openLiveCamera('sales');

const btnOpenGal = $('btn-open-gallery');
if (btnOpenGal) btnOpenGal.onclick = () => $('gallery-file-input')?.click();

const btnRetakeGal = $('btn-retake-gallery');
if (btnRetakeGal) btnRetakeGal.onclick = () => $('gallery-file-input')?.click();

const btnRemovePhoto = $('btn-remove-photo');
if (btnRemovePhoto) btnRemovePhoto.onclick = () => {
  if (confirm('Hapus foto ini?')) resetPhotoUI();
};

const camFileInput = $('camera-file-input');
if (camFileInput) {
  camFileInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoFile(file, file.name);
  };
}

const galFileInput = $('gallery-file-input');
if (galFileInput) {
  galFileInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoFile(file, file.name);
  };
}

// Camera modal buttons
const btnCamClose = $('btn-camera-close');
if (btnCamClose) btnCamClose.onclick = closeCameraModal;

const btnCamCancel = $('btn-camera-cancel');
if (btnCamCancel) btnCamCancel.onclick = closeCameraModal;

const btnCamShutter = $('btn-camera-shutter');
if (btnCamShutter) btnCamShutter.onclick = capturePhotoFromCamera;

const btnCamToGallery = $('btn-camera-to-gallery');
if (btnCamToGallery) {
  btnCamToGallery.onclick = () => {
    closeCameraModal();
    if (cameraTarget === 'driver') {
      $('driver-gallery-input')?.click();
    } else {
      $('gallery-file-input')?.click();
    }
  };
}

const btnCamFlip = $('btn-camera-flip');
if (btnCamFlip) btnCamFlip.onclick = toggleCameraFlip;

const btnCamFlash = $('btn-camera-flash');
if (btnCamFlash) btnCamFlash.onclick = toggleFlashlight;

// GPS Location wiring
const btnGetLocation = $('btn-get-location');
const locationDisplay = $('location-display');

if (btnGetLocation) {
  btnGetLocation.onclick = () => {
    if (!navigator.geolocation) {
      alert('Perangkat Anda tidak mendukung fitur Geolocation GPS.');
      return;
    }
    btnGetLocation.disabled = true;
    btnGetLocation.textContent = '⏳ Mengambil Lokasi GPS...';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        currentGeoLocation = { lat, lng, address: '' };

        if (locationDisplay) {
          locationDisplay.classList.add('has-location');
          locationDisplay.innerHTML = `
            <div class="location-text">📍 Mengambil alamat lokasi...</div>
            <div class="location-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
          `;
        }

        // Reverse geocode via Nominatim
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'User-Agent': 'AuditWA/1.0 (internal tool)' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.display_name && locationDisplay) {
              currentGeoLocation.address = data.display_name;
              locationDisplay.innerHTML = `
                <div class="location-text">📍 ${escHtml(data.display_name)}</div>
                <div class="location-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
              `;
            }
          }
        } catch (err) {
          currentGeoLocation.address = `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          if (locationDisplay) {
            locationDisplay.innerHTML = `
              <div class="location-text">📍 Koordinat GPS Tersimpan</div>
              <div class="location-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
            `;
          }
        }

        btnGetLocation.disabled = false;
        btnGetLocation.textContent = '📍 Perbarui Lokasi GPS';
      },
      (err) => {
        alert('Gagal mendapatkan lokasi GPS: ' + err.message);
        btnGetLocation.disabled = false;
        btnGetLocation.textContent = '📍 Dapatkan Lokasi GPS';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
}

// ──────────────────────────────────────────────────
// Role Locking Helper
// ──────────────────────────────────────────────────
function checkIsLocked(userGroup = '') {
  if (state.status === 'SELESAI') return true;
  const isDriver = (state.simulatedRole === 'Driver/Kenek' || state.simulatedRole === 'Sopir');
  const isGudang = (state.simulatedRole === 'Admin Gudang' || (userGroup && userGroup.toUpperCase().includes('GUDANG')));
  if (isGudang) {
    // Admin Gudang can edit when DRIVER_PROCESSED or SPV_APPROVED
    return !['DRIVER_PROCESSED', 'SPV_APPROVED'].includes(state.status);
  }
  if (isDriver) {
    return (state.status !== 'SPV_APPROVED');
  }
  // Salesman or Supervisor Sales
  return ['SPV_APPROVED', 'DRIVER_PROCESSED', 'SELESAI'].includes(state.status);
}

// ──────────────────────────────────────────────────
// Sync Return to Central Server (ORDS)
// ──────────────────────────────────────────────────
async function syncReturnNow(id) {
  const btnSyncRetur = $('btn-sync-retur');
  if (btnSyncRetur) {
    btnSyncRetur.disabled = true;
    btnSyncRetur.textContent = '⏳ Menyinkron...';
  }
  try {
    const res = await apiFetch(`/retur/${id}/sync`, { method: 'POST' });
    if (res.success && res.apexSynced) {
      showToast('✅ Berhasil disinkronkan ke Server Pusat!');
      if (state.returnDoc) state.returnDoc.isSynced = true;
      const syncStatusEl = $('rh-sync-status');
      if (syncStatusEl) {
        syncStatusEl.innerHTML = '<span style="color:#22c55e;font-weight:600;">✅ Tersimpan di Pusat</span>';
      }
      // Update item in allReturnsToday if present
      const itemInList = allReturnsToday.find(x => x.id === id);
      if (itemInList) itemInList.isSynced = true;
    } else {
      showError('Gagal sinkron ke pusat: ' + (res.message || 'Server pusat tidak merespon'));
    }
  } catch (err) {
    showError('Gagal sinkron: ' + err.message);
  } finally {
    if (btnSyncRetur) {
      btnSyncRetur.disabled = false;
      btnSyncRetur.innerHTML = '🔄 Sinkron';
    }
  }
}
window.syncReturnNow = syncReturnNow;

// ──────────────────────────────────────────────────
// Select & Edit Existing Return (Step 2 flow)
// ──────────────────────────────────────────────────
async function selectReturn(id) {
  try {
    const data = await apiFetch(`/retur/${id}`);
    const r = data.data;
    state.returnId = r.id;
    state.returnDoc = r;
    state.selectedSalespersonCode = r.salespersonCode || '';
    state.status = r.status || 'DRAFT';
    state.items = r.items ? r.items.filter(it => !it.deletedAt).map(it => ({
      ...it,
      price: it.price,
      totalPrice: it.totalPrice,
      _uoms: [{ label: it.uom, konversi: it.konversi, harga: it.price || 0, price: it.price || 0 }]
    })) : [];
    
    if (typeof renderHistory === 'function') {
      renderHistory(r.histories || []);
    }
    
    const progHeader = document.querySelector('.progress-header');
    if (progHeader) progHeader.style.display = 'none';
    
    $('btn-step2-back').onclick = () => {
      showScreen('screen-list');
      loadListToday();
    };

    // Populate Return Header Summary Card
    const rhCard = $('return-header-card');
    if (rhCard) {
      rhCard.classList.remove('hidden');
      $('rh-return-number').textContent = r.returnNumber || 'Draft Retur';
      $('rh-date').textContent = new Date(r.createdAt).toLocaleString('id-ID');
      
      const rhBadge = $('rh-status-badge');
      if (rhBadge) {
        rhBadge.className = 'badge badge-status ' + (
          r.status === 'SPV_APPROVED' ? 'badge-approved' :
          r.status === 'SPV_REJECTED' ? 'badge-rejected' :
          r.status === 'DRIVER_PROCESSED' ? 'badge-driver-processed' :
          r.status === 'SELESAI' ? 'badge-selesai' :
          (r.status === 'SUBMITTED' ? 'badge-submitted' : 'badge-draft')
        );
        rhBadge.textContent = (
          r.status === 'SPV_APPROVED' ? '✅ Disetujui SPV' :
          r.status === 'SPV_REJECTED' ? '❌ Ditolak SPV' :
          r.status === 'DRIVER_PROCESSED' ? '🚚 Sudah Ditarik Driver' :
          r.status === 'SELESAI' ? '🔒 Selesai (Gudang)' :
          (r.status === 'SUBMITTED' ? '⏳ Menunggu SPV' : 'Draft')
        );
      }

      $('rh-customer').textContent = `${r.customerCode || '-'} - ${r.customerName || '-'}`;
      $('rh-invoice').textContent = r.invoiceNumber || '— (Tanpa Faktur)';
      $('rh-sales').textContent = `${r.salespersonCode || '-'} (${r.salespersonName || '-'})`;
      $('rh-type').textContent = r.returnType || 'TUNAI';

      const locRow = $('rh-location-row');
      if (r.locationAddress || r.latitude) {
        locRow?.classList.remove('hidden');
        let locTxt = r.locationAddress || `${r.latitude}, ${r.longitude}`;
        if (r.distanceDiff !== null && r.distanceDiff !== undefined) {
          locTxt += ` (Selisih: ${Math.round(r.distanceDiff)}m)`;
        }
        $('rh-location').textContent = locTxt;
      } else {
        locRow?.classList.add('hidden');
      }

      // Driver location row
      const driverLocRow = $('rh-driver-location-row');
      if (r.driverLocationAddress || r.driverLatitude) {
        driverLocRow?.classList.remove('hidden');
        let dLocTxt = r.driverLocationAddress || `${r.driverLatitude}, ${r.driverLongitude}`;
        if (r.driverDistanceDiff !== null && r.driverDistanceDiff !== undefined) {
          dLocTxt += ` (Selisih: ${Math.round(r.driverDistanceDiff)}m)`;
        }
        $('rh-driver-location').textContent = dLocTxt;
      } else {
        driverLocRow?.classList.add('hidden');
      }

      // Sales photo row
      const photoRow = $('rh-photo-row');
      const photoImg = $('rh-photo-img');
      if (r.photoUrl) {
        photoRow?.classList.remove('hidden');
        if (photoImg) photoImg.src = r.photoUrl;
        window.previewHeaderPhoto = () => window.open(r.photoUrl, '_blank');
      } else {
        photoRow?.classList.add('hidden');
      }

      // Driver photo row
      const driverPhotoRow = $('rh-driver-photo-row');
      const driverPhotoImg = $('rh-driver-photo-img');
      if (r.driverPhotoUrl) {
        driverPhotoRow?.classList.remove('hidden');
        if (driverPhotoImg) driverPhotoImg.src = r.driverPhotoUrl;
        window.previewDriverHeaderPhoto = () => window.open(r.driverPhotoUrl, '_blank');
      } else {
        driverPhotoRow?.classList.add('hidden');
      }

      // Server Pusat Sync status
      const syncStatusEl = $('rh-sync-status');
      const btnSyncRetur = $('btn-sync-retur');
      if (syncStatusEl) {
        if (r.isSynced) {
          syncStatusEl.innerHTML = '<span style="color:#22c55e;font-weight:600;">✅ Tersimpan di Pusat</span>';
        } else {
          syncStatusEl.innerHTML = '<span style="color:#eab308;font-weight:600;">⏳ Belum Tersinkron</span>';
        }
      }
      if (btnSyncRetur) {
        btnSyncRetur.onclick = async () => {
          await syncReturnNow(r.id);
        };
      }
    }

    const isDriver = (state.simulatedRole === 'Driver/Kenek' || state.simulatedRole === 'Sopir');
    const userGroup = data.userGroup || '';
    const isGudang = (state.simulatedRole === 'Admin Gudang' || userGroup.toUpperCase().includes('GUDANG'));
    const isLocked = checkIsLocked(userGroup);

    // Invoice editing permission: Gudang when not locked, Driver on SPV_APPROVED, or Sales/SPV when not locked
    const canEditInvoice = (isGudang && !isLocked) || (isDriver && state.status === 'SPV_APPROVED') || (!isLocked && ['SUBMITTED', 'DRAFT'].includes(state.status));
    const btnEditInvoice = $('btn-edit-invoice');
    const invoiceEditBox = $('rh-invoice-edit-box');
    if (btnEditInvoice) {
      btnEditInvoice.style.display = canEditInvoice ? 'inline-flex' : 'none';
    }
    if (invoiceEditBox) {
      invoiceEditBox.classList.add('hidden');
    }

    // Return Type editing permission: Gudang when not locked, Driver on SPV_APPROVED, or Sales/SPV when not locked
    const canEditType = (isGudang && !isLocked) || (isDriver && state.status === 'SPV_APPROVED') || (!isLocked && ['SUBMITTED', 'DRAFT'].includes(state.status));
    const btnEditType = $('btn-edit-type');
    const typeEditBox = $('rh-type-edit-box');
    if (btnEditType) {
      btnEditType.style.display = canEditType ? 'inline-flex' : 'none';
    }
    if (typeEditBox) {
      typeEditBox.classList.add('hidden');
    }

    const lockBanner = $('rh-locked-banner');
    const driverBanner = $('rh-driver-banner');
    const gudangBanner = $('rh-gudang-banner');
    const btnHdrDriverSave = $('btn-header-driver-save');
    const btnHdrGudangApprove = $('btn-header-gudang-approve');
    const driverPickupCard = $('driver-pickup-card');

    if (isDriver && state.status === 'SPV_APPROVED') {
      if (lockBanner) lockBanner.classList.add('hidden');
      if (gudangBanner) gudangBanner.classList.add('hidden');
      if (driverBanner) driverBanner.classList.remove('hidden');
      if (btnHdrDriverSave) {
        btnHdrDriverSave.classList.remove('hidden');
        btnHdrDriverSave.style.display = '';
      }
      if (btnHdrGudangApprove) btnHdrGudangApprove.style.display = 'none';
      if (driverPickupCard) driverPickupCard.classList.remove('hidden');
      driverPhotoUrl = r.driverPhotoUrl || null;
      driverGeoLocation = (r.driverLatitude && r.driverLongitude) ? {
        lat: r.driverLatitude,
        lng: r.driverLongitude,
        address: r.driverLocationAddress || ''
      } : null;
      renderDriverPickupUI();
    } else if (isGudang && !isLocked) {
      if (lockBanner) lockBanner.classList.add('hidden');
      if (driverBanner) driverBanner.classList.add('hidden');
      if (gudangBanner) gudangBanner.classList.remove('hidden');
      if (btnHdrDriverSave) {
        btnHdrDriverSave.classList.add('hidden');
        btnHdrDriverSave.style.display = 'none';
      }
      if (btnHdrGudangApprove) {
        btnHdrGudangApprove.classList.remove('hidden');
        btnHdrGudangApprove.style.display = '';
      }
      if (driverPickupCard) driverPickupCard.classList.add('hidden');
      driverPhotoUrl = null;
      driverGeoLocation = null;
    } else {
      if (driverPickupCard) driverPickupCard.classList.add('hidden');
      driverPhotoUrl = null;
      driverGeoLocation = null;
      if (driverBanner) driverBanner.classList.add('hidden');
      if (gudangBanner) gudangBanner.classList.add('hidden');
      if (btnHdrDriverSave) {
        btnHdrDriverSave.classList.add('hidden');
        btnHdrDriverSave.style.display = 'none';
      }
      if (btnHdrGudangApprove) {
        btnHdrGudangApprove.classList.add('hidden');
        btnHdrGudangApprove.style.display = 'none';
      }
      if (lockBanner) {
        if (isLocked) {
          lockBanner.classList.remove('hidden');
          if (state.status === 'SELESAI') {
            lockBanner.textContent = '🔒 Retur telah disetujui & diselesaikan oleh Gudang. Dokumen ini telah dikunci permanen.';
          } else if (state.status === 'DRIVER_PROCESSED') {
            lockBanner.textContent = '🔒 Penarikan fisik barang telah selesai diproses oleh Driver. Menunggu penerimaan & verifikasi Gudang.';
          } else if (state.status === 'SPV_APPROVED' && !isDriver) {
            lockBanner.textContent = '🔒 Retur telah disetujui Supervisor Sales dan terkunci untuk Salesman/SPV.';
          } else if (isDriver && (state.status === 'SUBMITTED' || state.status === 'DRAFT')) {
            lockBanner.textContent = '⏳ Retur belum disetujui oleh Supervisor Sales.';
          } else {
            lockBanner.textContent = '🔒 Retur telah dikunci dan tidak dapat diubah lagi.';
          }
        } else {
          lockBanner.classList.add('hidden');
        }
      }
    }

    // Header buttons (Print Struk & SPV Actions)
    const btnHdrPrint = $('btn-header-print-struk');
    if (btnHdrPrint) {
      if (isLocked || r.status === 'SPV_APPROVED' || r.status === 'DRIVER_PROCESSED' || r.status === 'SELESAI') {
        btnHdrPrint.style.display = '';
        btnHdrPrint.onclick = () => openReceiptModal(state.returnId);
      } else {
        btnHdrPrint.style.display = 'none';
      }
    }

    const btnHdrApprove = $('btn-header-spv-approve');
    const btnHdrReject = $('btn-header-spv-reject');
    if (btnHdrApprove && btnHdrReject) {
      if (state.simulatedRole === 'Supervisor Sales' && !isLocked && r.status !== 'SPV_REJECTED') {
        btnHdrApprove.style.display = '';
        btnHdrReject.style.display = '';
        btnHdrApprove.onclick = async () => {
          await window.approveReturn(state.returnId);
          selectReturn(state.returnId);
        };
        btnHdrReject.onclick = async () => {
          await window.rejectReturn(state.returnId);
          selectReturn(state.returnId);
        };
      } else {
        btnHdrApprove.style.display = 'none';
        btnHdrReject.style.display = 'none';
      }
    }
    
    const btnNext = $('btn-step2-next');
    const btnFinish = $('btn-step2-finish');
    const btnAdd = $('btn-add-item');
    
    const canFinish = isGudang || userGroup.toUpperCase().includes('IT');
    
    if (isLocked) {
      btnNext.style.display = 'none';
      btnFinish.style.display = 'none';
      btnAdd.style.display = 'none';
    } else {
      btnNext.style.display = '';
      btnNext.disabled = false;
      btnFinish.style.display = canFinish ? '' : 'none';
      btnFinish.disabled = false;
      btnAdd.style.display = '';
      
      const saveFunction = async (isFinalSave = false) => {
        const activeItems = state.items.filter(it => !it.deletedAt && it.qty > 0);
        if (activeItems.length === 0) {
          alert('Minimal 1 barang harus dimasukkan.');
          return;
        }
        if (isDriver && isFinalSave) {
          if (!driverPhotoUrl) {
            alert('⚠️ Foto barang retur wajib dilampirkan oleh Driver.');
            $('driver-pickup-card')?.scrollIntoView({ behavior: 'smooth' });
            return;
          }
          if (!driverGeoLocation || driverGeoLocation.lat === null || driverGeoLocation.lat === undefined || driverGeoLocation.lng === null || driverGeoLocation.lng === undefined) {
            alert('⚠️ Share location (GPS) wajib diambil oleh Driver sebelum menyelesaikan penarikan.');
            $('driver-pickup-card')?.scrollIntoView({ behavior: 'smooth' });
            return;
          }
          if (!confirm('Selesaikan penarikan barang retur ini? Data fisik barang akan dikunci.')) return;
        }
        btnNext.disabled = true;
        if (btnHdrDriverSave) btnHdrDriverSave.disabled = true;
        btnNext.textContent = '⏳ Menyimpan...';
        try {
          const payload = { 
            items: activeItems, 
            role: state.simulatedRole,
            isFinal: isDriver ? isFinalSave : false
          };
          if (isDriver) {
            if (driverPhotoUrl) payload.driverPhotoUrl = driverPhotoUrl;
            if (driverGeoLocation && driverGeoLocation.lat && driverGeoLocation.lng) {
              payload.driverLatitude = driverGeoLocation.lat;
              payload.driverLongitude = driverGeoLocation.lng;
              payload.driverLocationAddress = driverGeoLocation.address || null;
            }
            if (state.returnDoc && state.returnDoc.returnType) {
              payload.returnType = state.returnDoc.returnType;
            }
          }
          const res = await apiFetch(`/retur/${state.returnId}/items`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          if (res && res.data && res.data.items) {
            state.items = res.data.items.filter(it => !it.deletedAt).map(it => ({
              ...it,
              price: it.price,
              totalPrice: it.totalPrice,
              _uoms: [{ label: it.uom, konversi: it.konversi, harga: it.price || 0, price: it.price || 0 }]
            }));
          }
          if (isDriver && isFinalSave) {
            $('success-return-number').textContent = 'Penarikan barang berhasil diselesaikan';
            document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
            $('step-success').classList.add('active');
            if (tg) { tg.MainButton.hide(); tg.disableClosingConfirmation(); }
            $('btn-close').onclick = () => {
              showScreen('screen-list');
              loadListToday();
            };
          } else {
            showToast(isGudang ? '✅ Perubahan barang berhasil disimpan oleh Gudang' : '✅ Perubahan berhasil disimpan');
            renderItemList();
          }
        } catch (err) {
          alert('Gagal menyimpan: ' + err.message);
        } finally {
          btnNext.disabled = false;
          if (btnHdrDriverSave) btnHdrDriverSave.disabled = false;
          if (isDriver && state.status === 'SPV_APPROVED') {
            btnNext.textContent = '🚚 Selesaikan Penarikan Barang';
          } else if (isGudang) {
            btnNext.textContent = '💾 Simpan Perubahan (Gudang)';
          } else {
            btnNext.textContent = '💾 Simpan Perubahan';
          }
        }
      };

      const approveWarehouseFunction = async () => {
        const activeItems = state.items.filter(it => !it.deletedAt && it.qty > 0);
        if (activeItems.length === 0) {
          alert('Minimal 1 barang harus dimasukkan sebelum approve retur.');
          return;
        }
        const confirmMsg = 'Approve dan selesaikan penerimaan retur fisik ini?\n\nPerhatian: Dokumen retur yang sudah diapprove Gudang akan dikunci permanen (SELESAI) dan tidak dapat diedit lagi oleh siapa pun.';
        if (!confirm(confirmMsg)) return;

        if (btnFinish) {
          btnFinish.disabled = true;
          btnFinish.textContent = '⏳ Memproses Approve...';
        }
        if (btnHdrGudangApprove) {
          btnHdrGudangApprove.disabled = true;
        }

        try {
          const res = await apiFetch(`/retur/${state.returnId}/finish`, {
            method: 'POST',
            body: JSON.stringify({
              role: state.simulatedRole || 'Admin Gudang',
              items: activeItems
            })
          });
          alert('✅ ' + (res.message || 'Retur berhasil disetujui oleh Gudang dan dikunci permanen (SELESAI).'));
          await selectReturn(state.returnId);
        } catch (err) {
          alert('Gagal approve retur: ' + err.message);
          if (btnFinish) {
            btnFinish.disabled = false;
            btnFinish.textContent = '✅ Simpan & Approve Retur';
          }
          if (btnHdrGudangApprove) {
            btnHdrGudangApprove.disabled = false;
          }
        }
      };

      if (isDriver && state.status === 'SPV_APPROVED') {
        btnNext.textContent = '🚚 Selesaikan Penarikan Barang';
        btnNext.onclick = () => saveFunction(true);
        if (btnHdrDriverSave) btnHdrDriverSave.onclick = () => saveFunction(true);
      } else if (isGudang) {
        btnNext.textContent = '💾 Simpan Perubahan (Gudang)';
        btnNext.onclick = () => saveFunction(false);
      } else {
        btnNext.textContent = '💾 Simpan Perubahan';
        btnNext.onclick = () => saveFunction(false);
      }

      if (isGudang) {
        btnFinish.textContent = '✅ Simpan & Approve Retur';
        btnFinish.className = 'btn btn-success';
        btnFinish.style.background = '#10b981';
        btnFinish.style.borderColor = '#10b981';
        btnFinish.style.color = '#fff';
        btnFinish.onclick = approveWarehouseFunction;
        if (btnHdrGudangApprove) btnHdrGudangApprove.onclick = approveWarehouseFunction;
      } else {
        btnFinish.textContent = '🔒 Selesai';
        btnFinish.onclick = async () => {
          if (!confirm('Akhiri pengeditan? Data tidak akan bisa diubah lagi.')) return;
          btnFinish.disabled = true;
          btnFinish.textContent = '⏳ Selesai...';
          try {
             await apiFetch(`/retur/${state.returnId}/finish`, { method: 'POST' });
             alert('Retur berhasil dikunci (SELESAI).');
             selectReturn(state.returnId);
          } catch (err) {
             alert('Gagal menyelesaikan: ' + err.message);
             btnFinish.disabled = false;
             btnFinish.textContent = '🔒 Selesai';
          }
        };
      }
      
      btnAdd.onclick = () => openModal(-1);
    }
    
    renderItemList();
    showScreen('screen-app');
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    $('step-2').classList.add('active');
  } catch (err) {
    alert('Gagal memuat detail retur: ' + err.message);
  }
}

// ──────────────────────────────────────────────────
// Invoice Editing (Driver / SPV / Sales)
// ──────────────────────────────────────────────────
const btnEditInvoice = $('btn-edit-invoice');
const invoiceEditBox = $('rh-invoice-edit-box');
const invoiceInput = $('rh-invoice-input');
const btnSaveInvoice = $('btn-save-invoice');
const btnCancelInvoice = $('btn-cancel-invoice');

if (btnEditInvoice) {
  btnEditInvoice.onclick = () => {
    if (!invoiceEditBox) return;
    const curVal = (state.returnDoc && state.returnDoc.invoiceNumber) || '';
    if (invoiceInput) invoiceInput.value = curVal;
    invoiceEditBox.classList.remove('hidden');
    if (invoiceInput) invoiceInput.focus();
  };
}

if (btnCancelInvoice) {
  btnCancelInvoice.onclick = () => {
    if (invoiceEditBox) invoiceEditBox.classList.add('hidden');
  };
}

if (btnSaveInvoice) {
  btnSaveInvoice.onclick = async () => {
    if (!state.returnId) return;
    const val = (invoiceInput?.value || '').trim();
    btnSaveInvoice.disabled = true;
    btnSaveInvoice.textContent = '...';
    try {
      const res = await apiFetch(`/retur/${state.returnId}/invoice`, {
        method: 'POST',
        body: JSON.stringify({ invoiceNumber: val, role: state.simulatedRole })
      });
      if (res && res.data) {
        if (state.returnDoc) state.returnDoc.invoiceNumber = val;
        $('rh-invoice').textContent = val || '— (Tanpa Faktur)';
        showToast('✅ No Faktur berhasil diperbarui');
      }
      if (invoiceEditBox) invoiceEditBox.classList.add('hidden');
    } catch (err) {
      alert('Gagal menyimpan No Faktur: ' + err.message);
    } finally {
      btnSaveInvoice.disabled = false;
      btnSaveInvoice.textContent = 'Simpan';
    }
  };
}

if (invoiceInput) {
  invoiceInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnSaveInvoice?.click();
    } else if (e.key === 'Escape') {
      btnCancelInvoice?.click();
    }
  });
}

// ──────────────────────────────────────────────────
// Return Type Editing (Driver / SPV / Sales)
// ──────────────────────────────────────────────────
const btnEditType = $('btn-edit-type');
const typeEditBox = $('rh-type-edit-box');
const btnTypeTunai = $('btn-type-tunai');
const btnTypeKredit = $('btn-type-kredit');
const btnSaveType = $('btn-save-type');
const btnCancelType = $('btn-cancel-type');

function updateTypeButtonsUI() {
  if (btnTypeTunai) {
    const isTunai = editingReturnType === 'TUNAI';
    btnTypeTunai.style.background = isTunai ? 'var(--tg-accent)' : 'transparent';
    btnTypeTunai.style.color = isTunai ? '#ffffff' : 'var(--tg-text)';
    btnTypeTunai.style.borderColor = isTunai ? 'var(--tg-accent)' : 'var(--tg-border)';
  }
  if (btnTypeKredit) {
    const isKredit = editingReturnType === 'KREDIT';
    btnTypeKredit.style.background = isKredit ? 'var(--tg-accent)' : 'transparent';
    btnTypeKredit.style.color = isKredit ? '#ffffff' : 'var(--tg-text)';
    btnTypeKredit.style.borderColor = isKredit ? 'var(--tg-accent)' : 'var(--tg-border)';
  }
}

if (btnEditType) {
  btnEditType.onclick = () => {
    if (!typeEditBox) return;
    editingReturnType = (state.returnDoc && state.returnDoc.returnType) || 'TUNAI';
    updateTypeButtonsUI();
    typeEditBox.classList.remove('hidden');
  };
}

if (btnTypeTunai) {
  btnTypeTunai.onclick = () => {
    editingReturnType = 'TUNAI';
    updateTypeButtonsUI();
  };
}

if (btnTypeKredit) {
  btnTypeKredit.onclick = () => {
    editingReturnType = 'KREDIT';
    updateTypeButtonsUI();
  };
}

if (btnCancelType) {
  btnCancelType.onclick = () => {
    if (typeEditBox) typeEditBox.classList.add('hidden');
  };
}

if (btnSaveType) {
  btnSaveType.onclick = async () => {
    if (!state.returnId) return;
    if (!['TUNAI', 'KREDIT'].includes(editingReturnType)) {
      alert('Pilih Tipe Retur: TUNAI atau KREDIT');
      return;
    }
    btnSaveType.disabled = true;
    btnSaveType.textContent = '...';
    try {
      const res = await apiFetch(`/retur/${state.returnId}/type`, {
        method: 'POST',
        body: JSON.stringify({ returnType: editingReturnType, role: state.simulatedRole })
      });
      if (res && res.data) {
        if (state.returnDoc) state.returnDoc.returnType = editingReturnType;
        $('rh-type').textContent = editingReturnType;
        showToast(`✅ Tipe Retur berhasil diubah ke ${editingReturnType}`);
      }
      if (typeEditBox) typeEditBox.classList.add('hidden');
    } catch (err) {
      alert('Gagal mengubah Tipe Retur: ' + err.message);
    } finally {
      btnSaveType.disabled = false;
      btnSaveType.textContent = 'Simpan';
    }
  };
}

// ──────────────────────────────────────────────────
// Driver Pickup Evidence (Photo & GPS)
// ──────────────────────────────────────────────────
function renderDriverPickupUI() {
  const photoBadge = $('driver-photo-badge');
  const photoActions = $('driver-photo-actions');
  const photoWrap = $('driver-photo-preview-wrap');
  const photoImg = $('driver-photo-preview-img');
  const photoStatus = $('driver-photo-upload-status');

  if (driverPhotoUrl) {
    if (photoImg) {
      photoImg.src = driverPhotoUrl;
      photoImg.onclick = () => window.open(driverPhotoUrl, '_blank');
    }
    if (photoWrap) photoWrap.classList.remove('hidden');
    if (photoActions) photoActions.style.display = 'none';
    if (photoBadge) {
      photoBadge.textContent = '✅ Terunggah';
      photoBadge.style.background = 'rgba(85, 230, 122, 0.2)';
      photoBadge.style.color = '#55e67a';
    }
    if (photoStatus) {
      photoStatus.textContent = '✅ Foto siap';
      photoStatus.style.color = '#55e67a';
    }
  } else {
    if (photoWrap) photoWrap.classList.add('hidden');
    if (photoActions) photoActions.style.display = 'flex';
    if (photoBadge) {
      photoBadge.textContent = 'Belum ada foto *Wajib';
      photoBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      photoBadge.style.color = '#ef4444';
    }
  }

  const locBadge = $('driver-location-badge');
  const locDisplay = $('driver-location-display');
  if (driverGeoLocation && driverGeoLocation.lat && driverGeoLocation.lng) {
    if (locBadge) {
      locBadge.textContent = '✅ Ada Lokasi';
      locBadge.style.background = 'rgba(85, 230, 122, 0.2)';
      locBadge.style.color = '#55e67a';
    }
    if (locDisplay) {
      locDisplay.innerHTML = `
        <div class="location-text" style="font-size:11.5px; font-weight:500;">📍 ${escHtml(driverGeoLocation.address || 'Koordinat GPS didapatkan')}</div>
        <div class="location-coords" style="font-size:10.5px; color:var(--tg-hint); margin-top:2px;">${driverGeoLocation.lat.toFixed(6)}, ${driverGeoLocation.lng.toFixed(6)}</div>
      `;
    }
  } else {
    if (locBadge) {
      locBadge.textContent = 'Belum ada lokasi *Wajib';
      locBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      locBadge.style.color = '#ef4444';
    }
    if (locDisplay) {
      locDisplay.innerHTML = `<p class="location-hint" style="font-size: 11px; margin: 0; color: #ef4444;">⚠️ Tekan tombol di bawah untuk mendeteksi GPS (Wajib)</p>`;
    }
  }
}

async function handleDriverPhotoFile(fileOrBlob, fileName = 'driver_retur.jpg') {
  if (!fileOrBlob) return;

  const photoBadge = $('driver-photo-badge');
  const photoActions = $('driver-photo-actions');
  const photoWrap = $('driver-photo-preview-wrap');
  const photoImg = $('driver-photo-preview-img');
  const photoStatus = $('driver-photo-upload-status');
  const btnRetake = $('btn-driver-retake');
  const btnRemove = $('btn-driver-remove-photo');

  // 1. Instant local preview
  const reader = new FileReader();
  reader.onload = (e) => {
    if (photoImg) photoImg.src = e.target.result;
    if (photoActions) photoActions.style.display = 'none';
    if (photoWrap) photoWrap.classList.remove('hidden');
    if (photoStatus) {
      photoStatus.textContent = '⏳ Mengunggah foto...';
      photoStatus.style.color = '#ff9f0a';
    }
    if (photoBadge) {
      photoBadge.textContent = '⏳ Mengunggah';
      photoBadge.style.background = 'rgba(255, 159, 10, 0.2)';
      photoBadge.style.color = '#ff9f0a';
    }
  };
  reader.readAsDataURL(fileOrBlob);

  // 2. Upload to server
  const formData = new FormData();
  formData.append('photo', fileOrBlob, fileName);

  try {
    if (btnRetake) btnRetake.disabled = true;
    if (btnRemove) btnRemove.disabled = true;

    const headers = {
      'x-telegram-init-data': state.initData,
      'x-telegram-session-id': state.sessionId,
    };
    const res = await fetch(`${API}/uploads/photo`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Upload gagal');
    }
    const data = await res.json();
    driverPhotoUrl = data.url;

    if (photoStatus) {
      photoStatus.textContent = '✅ Foto berhasil diunggah';
      photoStatus.style.color = '#55e67a';
    }
    if (photoBadge) {
      photoBadge.textContent = '✅ Terunggah';
      photoBadge.style.background = 'rgba(85, 230, 122, 0.2)';
      photoBadge.style.color = '#55e67a';
    }
    showToast('✅ Foto driver berhasil diunggah');
  } catch (err) {
    console.error('Driver photo upload error:', err);
    alert('Gagal mengunggah foto: ' + err.message);
    if (photoStatus) {
      photoStatus.textContent = '⚠️ Gagal diunggah. Coba lagi.';
      photoStatus.style.color = '#ff453a';
    }
    if (photoBadge) {
      photoBadge.textContent = '⚠️ Gagal';
      photoBadge.style.background = 'rgba(255, 69, 58, 0.2)';
      photoBadge.style.color = '#ff453a';
    }
  } finally {
    if (btnRetake) btnRetake.disabled = false;
    if (btnRemove) btnRemove.disabled = false;
  }
}

// Driver photo inputs and buttons
const driverCamInput = $('driver-camera-input');
if (driverCamInput) {
  driverCamInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleDriverPhotoFile(file, file.name);
  };
}

const driverGalInput = $('driver-gallery-input');
if (driverGalInput) {
  driverGalInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleDriverPhotoFile(file, file.name);
  };
}

const btnDriverCam = $('btn-driver-camera');
if (btnDriverCam) {
  btnDriverCam.onclick = () => openLiveCamera('driver');
}

const btnDriverGal = $('btn-driver-gallery');
if (btnDriverGal) {
  btnDriverGal.onclick = () => $('driver-gallery-input')?.click();
}

const btnDriverRetake = $('btn-driver-retake');
if (btnDriverRetake) {
  btnDriverRetake.onclick = () => openLiveCamera('driver');
}

const btnDriverRemove = $('btn-driver-remove-photo');
if (btnDriverRemove) {
  btnDriverRemove.onclick = () => {
    if (confirm('Hapus foto penarikan driver ini?')) {
      driverPhotoUrl = null;
      renderDriverPickupUI();
      showToast('Foto driver dihapus');
    }
  };
}

// Driver GPS button
const btnDriverGetLoc = $('btn-driver-get-location');
if (btnDriverGetLoc) {
  btnDriverGetLoc.onclick = () => {
    if (!navigator.geolocation) {
      alert('Perangkat Anda tidak mendukung fitur Geolocation GPS.');
      return;
    }
    btnDriverGetLoc.disabled = true;
    btnDriverGetLoc.textContent = '⏳ Mengambil Lokasi GPS...';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        driverGeoLocation = { lat, lng, address: '' };

        const locDisplay = $('driver-location-display');
        const locBadge = $('driver-location-badge');
        if (locBadge) {
          locBadge.textContent = '⏳ Cek Alamat...';
          locBadge.style.background = 'rgba(255, 159, 10, 0.2)';
          locBadge.style.color = '#ff9f0a';
        }
        if (locDisplay) {
          locDisplay.innerHTML = `
            <div class="location-text" style="font-size:11.5px;">📍 Mengambil alamat lokasi...</div>
            <div class="location-coords" style="font-size:10.5px; color:var(--tg-hint); margin-top:2px;">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
          `;
        }

        // Reverse geocode via Nominatim
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'User-Agent': 'AuditWA/1.0 (internal tool)' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              driverGeoLocation.address = data.display_name;
            }
          }
        } catch (err) {
          console.warn('Nominatim reverse geocode error:', err);
          driverGeoLocation.address = `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }

        renderDriverPickupUI();
        btnDriverGetLoc.disabled = false;
        btnDriverGetLoc.textContent = '📍 Perbarui Lokasi GPS Driver';
        showToast('✅ Lokasi GPS Driver berhasil didapatkan');
      },
      (err) => {
        console.error('Driver GPS error:', err);
        alert('Gagal mendapatkan lokasi GPS: ' + err.message + '\nPastikan izin lokasi telah aktif.');
        btnDriverGetLoc.disabled = false;
        btnDriverGetLoc.textContent = '📍 Dapatkan Lokasi GPS Driver';
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };
}

function getGroupedItems() {
  const groups = {};
  state.items.forEach(it => {
    // Hanya tampilkan item yang aktif (tidak dihapus dan qty > 0)
    if (it.deletedAt || !(it.qty > 0)) return;

    if (!groups[it.productCode]) {
      groups[it.productCode] = {
        productCode: it.productCode,
        productName: it.productName || it.nmbrg || it.name,
        alasan: it.alasan,
        uoms: []
      };
    } else if (!groups[it.productCode].productName && (it.productName || it.nmbrg || it.name)) {
      groups[it.productCode].productName = it.productName || it.nmbrg || it.name;
    }
    const p = it.price !== undefined && it.price !== null ? parseFloat(it.price) : (it.harga || 0);
    const sub = it.totalPrice !== undefined && it.totalPrice !== null ? parseFloat(it.totalPrice) : (p * (it.qty || 0));

    groups[it.productCode].uoms.push({
      id: it.id,
      uom: it.uom,
      qty: it.qty,
      qtyGood: it.qtyGood,
      qtyBad: it.qtyBad,
      konversi: it.konversi,
      price: p,
      totalPrice: sub,
      originalQty: it.originalQty,
    });
  });
  return Object.values(groups);
}

function renderHistory(histories) {
  const container = $('history-list');
  if (!container) return;
  if (!histories || histories.length === 0) {
    container.innerHTML = '<span style="color:var(--tg-hint)">Tidak ada riwayat.</span>';
    return;
  }
  container.innerHTML = histories.map(h => {
    const d = new Date(h.createdAt).toLocaleString('id-ID');
    return `
      <div style="margin-bottom:6px; padding-left:10px; border-left:2px solid var(--tg-accent)">
        <div style="font-weight:600">${escHtml(h.action)} <span style="font-weight:normal;color:var(--tg-hint);font-size:10px;">- ${d}</span></div>
        <div style="color:var(--tg-hint);">Oleh: ${escHtml(h.actorName || 'User')} (${escHtml(h.actorRole || 'System')})</div>
      </div>
    `;
  }).join('');
}

function renderItemList() {
  const list = $('item-list');
  const badge = $('item-count-badge');
  const grouped = getGroupedItems();
  const isLocked = checkIsLocked();

  let grandTotal = 0;
  grouped.forEach(g => {
    g.uoms.forEach(u => {
      if (u.totalPrice) grandTotal += u.totalPrice;
    });
  });

  if (badge) {
    if (grandTotal > 0) {
      badge.textContent = `${grouped.length} item · Rp ${Math.round(grandTotal).toLocaleString('id-ID')}`;
    } else {
      badge.textContent = `${grouped.length} item`;
    }
  }

  if (grouped.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--tg-hint);font-size:13px">
      Belum ada barang ditambahkan</div>`;
    return;
  }

  let html = '';
  if (grandTotal > 0) {
    html += `
      <div class="grand-total-summary-card" style="background:linear-gradient(135deg, rgba(91,110,245,0.15), rgba(52,199,89,0.15)); border:1px solid rgba(91,110,245,0.3); border-radius:var(--radius-sm); padding:10px 14px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span style="font-size:11px; color:var(--tg-hint); display:block; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Total Estimasi Retur</span>
          <span style="font-size:17px; font-weight:700; color:#55e67a;">Rp ${Math.round(grandTotal).toLocaleString('id-ID')}</span>
        </div>
        <span class="badge" style="background:var(--tg-accent);">${grouped.length} SKU</span>
      </div>
    `;
  }

  html += grouped.map((group, i) => {
    let groupSubtotal = 0;
    const uomsStr = group.uoms.map(u => {
      if (u.totalPrice) groupSubtotal += u.totalPrice;
      let badges = [];
      if (u.qtyGood > 0) {
        badges.push(`<span class="badge-stock badge-good">🟢 ${u.qtyGood} ${escHtml(u.uom)} Good</span>`);
      }
      if (u.qtyBad > 0) {
        badges.push(`<span class="badge-stock badge-bad">🔴 ${u.qtyBad} ${escHtml(u.uom)} Bad</span>`);
      }
      if (badges.length === 0) {
        badges.push(`<span class="badge-stock badge-total">${u.qty} ${escHtml(u.uom)}</span>`);
      } else if (u.qtyGood > 0 && u.qtyBad > 0) {
        badges.push(`<span class="badge-stock badge-total">Total: ${u.qty}</span>`);
      }
      const priceText = u.price ? `<span style="font-size:11px; color:var(--tg-hint); margin-left:4px;">@ Rp ${Math.round(u.price).toLocaleString('id-ID')}</span>` : '';
      return `<div style="display:inline-flex; flex-wrap:wrap; gap:4px; align-items:center; margin-bottom:2px;">${badges.join('')} ${priceText}</div>`;
    }).join(' ');

    const hasFooter = Boolean(group.alasan || groupSubtotal > 0);
    const footerHtml = hasFooter ? `
      <div class="item-card-footer">
        <div class="item-alasan">${group.alasan ? `<span class="alasan-label">Alasan:</span> ${escHtml(group.alasan)}` : ''}</div>
        ${groupSubtotal > 0 ? `<div class="item-subtotal"><span class="subtotal-label">Subtotal:</span> Rp ${Math.round(groupSubtotal).toLocaleString('id-ID')}</div>` : ''}
      </div>
    ` : '';

    return `
    <div class="item-card" data-index="${i}">
      <div class="item-card-header">
        <div class="item-title-wrap">
          <div class="item-number">${i + 1}</div>
          <div class="item-title-info">
            <div class="item-name">${escHtml(group.productName || group.productCode || '—')}</div>
            <div class="item-code">${escHtml(group.productCode || '')}</div>
          </div>
        </div>
        <div class="item-actions">
          ${isLocked ? '' : `<button class="icon-btn edit" onclick="openModal('${group.productCode}')" title="Edit">✏️</button>
          <button class="icon-btn delete" onclick="deleteItem('${group.productCode}')" title="Hapus">🗑️</button>`}
        </div>
      </div>
      <div class="item-card-body">
        <div class="item-detail">${uomsStr}</div>
      </div>
      ${footerHtml}
    </div>
  `}).join('');

  list.innerHTML = html;
}

function deleteItem(productCode) {
  const isLocked = checkIsLocked();
  if (isLocked) {
    alert(state.status === 'SELESAI' ? 'Retur yang sudah disetujui Gudang telah dikunci permanen.' : 'Retur yang sudah disetujui tidak dapat diedit lagi.');
    return;
  }
  if (!confirm('Hapus barang ini?')) return;
  state.items.forEach(it => {
    if (it.productCode === productCode) {
      it.deletedAt = new Date().toISOString();
    }
  });
  renderItemList();

  if (state.returnId && !isLocked) {
    const activeItems = state.items.filter(it => !it.deletedAt && it.qty > 0);
    apiFetch(`/retur/${state.returnId}/items`, {
      method: 'POST',
      body: JSON.stringify({ 
        items: activeItems, 
        role: state.simulatedRole,
        isFinal: false
      }),
    }).then(res => {
      if (res && res.data && res.data.items) {
        state.items = res.data.items.filter(it => !it.deletedAt).map(it => ({
          ...it,
          _uoms: [{ label: it.uom, konversi: it.konversi }]
        }));
        renderItemList();
      }
      showToast('Barang berhasil dihapus');
    }).catch(err => {
      console.warn('Auto-save on delete failed:', err);
    });
  }
}

function getActiveSalesCode() {
  // If inspecting/editing an existing return that has returnId and returnDoc
  if (state.returnId && state.returnDoc && state.returnDoc.salespersonCode) {
    return state.returnDoc.salespersonCode.trim();
  }
  // In Create return flow, the header dropdown in Step 1 is the primary source of truth
  const s1Val = $('s1-sales-code')?.value;
  if (s1Val && s1Val.trim()) {
    return s1Val.trim();
  }
  if (state.selectedSalespersonCode && state.selectedSalespersonCode.trim()) {
    return state.selectedSalespersonCode.trim();
  }
  if (state.returnDoc && state.returnDoc.salespersonCode) {
    return state.returnDoc.salespersonCode.trim();
  }
  if (state.kodeSales) {
    return state.kodeSales.split(/[:;,]/)[0].trim();
  }
  return '';
}

// ──────────────────────────────────────────────────
// MODAL — Input / Edit Item Barang
// ──────────────────────────────────────────────────
async function openModal(editProductCode) {
  const isLocked = checkIsLocked();
  if (isLocked) {
    alert(state.status === 'SELESAI' ? 'Retur yang sudah disetujui Gudang telah dikunci permanen.' : 'Retur yang sudah disetujui tidak dapat diedit lagi.');
    return;
  }

  modal.editProductCode = editProductCode;
  modal.selectedProduct = null;
  modal.selectedAlasan  = '';

  const activeSalesCode = getActiveSalesCode();
  const isEdit = typeof editProductCode === 'string';
  const modalTitle = $('modal-title');
  if (modalTitle) {
    modalTitle.innerHTML = isEdit
      ? 'Edit Barang'
      : `Tambah Barang ${activeSalesCode ? `<span style="font-size:12px; font-weight:normal; color:var(--tg-accent); margin-left:6px;">[Sales: ${escHtml(activeSalesCode)}]</span>` : ''}`;
  }

  if (isEdit) {
    const productItems = state.items.filter(it => it.productCode === editProductCode && !it.deletedAt);
    if (!productItems.length) return;
    const item = productItems[0];
    
    $('product-search-input').classList.add('hidden');
    $('sel-product-name').textContent = 'Memuat data...';
    $('selected-product-display').classList.remove('hidden');
    const btnClear = $('btn-clear-product');
    if (btnClear) btnClear.style.display = 'none'; // Jangan izinkan ganti produk saat mode edit item
    
    // Fetch real product to get all available UOMs
    try {
      const data = await apiFetch(`/products/search?q=${encodeURIComponent(editProductCode)}&kodeSales=${encodeURIComponent(activeSalesCode)}&returnId=${encodeURIComponent(state.returnId || '')}&role=${encodeURIComponent(state.simulatedRole || '')}`);
      const products = data.data || [];
      const realProduct = products.find(p => p.kdbrg === editProductCode) || null;
      
      const allUoms = realProduct && realProduct.uoms ? realProduct.uoms : [{ label: item.uom, konversi: item.konversi, harga: item.price || 0, price: item.price || 0 }];
      const uomsFromItems = productItems.map(it => ({ label: it.uom, konversi: it.konversi, harga: it.price || 0, price: it.price || 0, qty: it.qty, qtyGood: it.qtyGood, qtyBad: it.qtyBad, id: it.id }));
      
      modal.selectedProduct = {
        kdbrg: item.productCode,
        nmbrg: item.productName || (realProduct ? realProduct.nmbrg : ''),
        uoms: allUoms, 
      };
      modal.selectedProduct.prefillUoms = uomsFromItems;
      modal.selectedAlasan = item.alasan || '';
      
      renderSelectedProduct(modal.selectedProduct);
      renderUomCounters();
      $('alasan-input').value = modal.selectedAlasan;
    } catch (err) {
      console.error('Failed to fetch full product for edit', err);
      // Fallback
      modal.selectedProduct = {
        kdbrg: item.productCode,
        nmbrg: item.productName,
        uoms: [{ label: item.uom, konversi: item.konversi, harga: item.price || 0, price: item.price || 0 }],
      };
      modal.selectedProduct.prefillUoms = productItems.map(it => ({ label: it.uom, konversi: it.konversi, harga: it.price || 0, price: it.price || 0, qty: it.qty, qtyGood: it.qtyGood, qtyBad: it.qtyBad, id: it.id }));
      modal.selectedAlasan = item.alasan || '';
      renderSelectedProduct(modal.selectedProduct);
      renderUomCounters();
      $('alasan-input').value = modal.selectedAlasan;
    }
  } else {
    const btnClear = $('btn-clear-product');
    if (btnClear) btnClear.style.display = '';
    const searchInput = $('product-search-input');
    if (searchInput) {
      searchInput.value = '';
      searchInput.placeholder = activeSalesCode ? `Cari barang (${activeSalesCode})...` : 'Ketik kode atau nama...';
    }
    $('selected-product-display').classList.add('hidden');
    $('product-search-input').classList.remove('hidden');
    $('product-suggestions').classList.add('hidden');
    $('uom-counters-container').style.display = 'none';
    $('alasan-input').value = '';
  }

  renderAlasanPresets();
  $('modal-overlay').classList.remove('hidden');
  if (!isEdit) setTimeout(() => $('product-search-input').focus(), 100);
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
  $('product-suggestions').classList.add('hidden');
}

function renderSelectedProduct(product) {
  $('product-search-input').classList.add('hidden');
  const disp = $('selected-product-display');
  disp.classList.remove('hidden');
  $('sel-product-name').textContent = `${product.nmbrg || product.kdbrg}`;
}

function renderUomCounters() {
  if (!modal.selectedProduct?.uoms?.length) return;
  $('uom-counters-container').style.display = '';

  const list = $('uom-counters-list');
  const prefill = modal.selectedProduct.prefillUoms || [];

  list.innerHTML = modal.selectedProduct.uoms.map((u, i) => {
    const p = prefill.find(pf => pf.label === u.label);
    const qtyGood = p ? (p.qtyGood ?? (p.qty && !p.qtyBad ? p.qty : 0)) : 0;
    const qtyBad = p ? (p.qtyBad ?? 0) : 0;
    const total = qtyGood + qtyBad;
    const harga = parseFloat(u.harga ?? u.price) || 0;
    const subtotal = total * harga;

    return `
      <div class="uom-card" data-label="${escHtml(u.label)}" data-konversi="${u.konversi || 1}" data-harga="${harga}">
        <div class="uom-header">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span class="uom-title">Satuan: <strong>${escHtml(u.label)}</strong> <span style="font-weight:normal;color:var(--tg-hint);font-size:11px;">(Isi ${u.konversi || 1} pcs)</span></span>
            <span class="uom-price" style="font-size:12px; font-weight:600; color:var(--tg-accent, #5b6ef5);">Rp ${Math.round(harga).toLocaleString('id-ID')} / ${escHtml(u.label)}</span>
          </div>
          <div style="text-align:right;">
            <span class="uom-total-badge" id="uom-total-${i}">Total: ${total} ${escHtml(u.label)}</span>
            <div id="uom-subtotal-${i}" style="font-size:11px; font-weight:600; color:#55e67a; margin-top:3px;">
              Subtotal: Rp ${Math.round(subtotal).toLocaleString('id-ID')}
            </div>
          </div>
        </div>
        <div class="uom-counters-grid">
          <!-- GOOD Stock -->
          <div class="counter-box counter-good">
            <div class="counter-header">
              <span class="dot dot-good"></span>
              <span class="counter-title">GOOD (Bagus)</span>
            </div>
            <div class="qty-input-wrap">
              <button type="button" class="qty-btn" onclick="updateQty(${i}, -1, 'qtyGood')">−</button>
              <input type="number" id="qtyGood-input-${i}" class="form-input qty-input" value="${qtyGood}" min="0" step="1" oninput="onQtyInput(${i}, '${escHtml(u.label)}')" />
              <button type="button" class="qty-btn" onclick="updateQty(${i}, 1, 'qtyGood')">＋</button>
            </div>
          </div>
          <!-- BAD Stock -->
          <div class="counter-box counter-bad">
            <div class="counter-header">
              <span class="dot dot-bad"></span>
              <span class="counter-title">BAD (Rusak/BS)</span>
            </div>
            <div class="qty-input-wrap">
              <button type="button" class="qty-btn" onclick="updateQty(${i}, -1, 'qtyBad')">−</button>
              <input type="number" id="qtyBad-input-${i}" class="form-input qty-input" value="${qtyBad}" min="0" step="1" oninput="onQtyInput(${i}, '${escHtml(u.label)}')" />
              <button type="button" class="qty-btn" onclick="updateQty(${i}, 1, 'qtyBad')">＋</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.updateQty = (index, delta, type = 'qtyGood') => {
  const inputId = `${type}-input-${index}`;
  const input = $(inputId);
  if (!input) return;
  let v = parseInt(input.value) || 0;
  v += delta;
  if (v < 0) v = 0;
  input.value = v;

  const card = input.closest('.uom-card');
  const uomLabel = card ? card.dataset.label : '';
  onQtyInput(index, uomLabel);
};

window.onQtyInput = (index, uomLabel = '') => {
  const good = parseInt($(`qtyGood-input-${index}`)?.value) || 0;
  const bad = parseInt($(`qtyBad-input-${index}`)?.value) || 0;
  const total = good + bad;
  const totalBadge = $(`uom-total-${index}`);
  if (totalBadge) {
    totalBadge.textContent = `Total: ${total} ${uomLabel}`.trim();
  }
  const card = $(`qtyGood-input-${index}`)?.closest('.uom-card');
  const harga = parseFloat(card?.dataset?.harga) || 0;
  const subtotalBadge = $(`uom-subtotal-${index}`);
  if (subtotalBadge) {
    subtotalBadge.textContent = `Subtotal: Rp ${Math.round(total * harga).toLocaleString('id-ID')}`;
  }
};

function renderAlasanPresets() {
  const container = $('alasan-presets');
  if (!container) return;
  container.innerHTML = state.alasanPreset.map(a => `
    <button type="button" class="alasan-chip ${modal.selectedAlasan === a ? 'active' : ''}"
      data-value="${escHtml(a)}">${escHtml(a)}</button>
  `).join('');

  container.querySelectorAll('.alasan-chip').forEach(chip => {
    chip.onclick = () => {
      const val = chip.dataset.value;
      if (modal.selectedAlasan === val) {
        modal.selectedAlasan = '';
        $('alasan-input').value = '';
      } else {
        modal.selectedAlasan = val;
        $('alasan-input').value = val;
      }
      container.querySelectorAll('.alasan-chip').forEach(c => c.classList.remove('active'));
      if (modal.selectedAlasan) chip.classList.add('active');
    };
  });
}

// Product search
let searchTimeout = null;
let searchResultsCache = [];
const productSearchInput = $('product-search-input');
if (productSearchInput) {
  productSearchInput.addEventListener('input', e => {
    const q = e.target.value.trim();
    clearTimeout(searchTimeout);
    if (q.length < 2) {
      $('product-suggestions').classList.add('hidden');
      return;
    }
    searchTimeout = setTimeout(() => searchProducts(q), 300);
  });

  productSearchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchTimeout);
      const q = e.target.value.trim();
      if (q.length >= 2) {
        searchProducts(q);
      }
    }
  });
}

document.addEventListener('click', e => {
  const dropdown = $('product-suggestions');
  const input = $('product-search-input');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!dropdown.contains(e.target) && e.target !== input) {
      dropdown.classList.add('hidden');
    }
  }
});

async function searchProducts(q) {
  try {
    const activeSalesCode = getActiveSalesCode();
    const role = state.simulatedRole || '';
    const returnIdParam = state.returnId || '';
    const url = `/products/search?q=${encodeURIComponent(q)}&kodeSales=${encodeURIComponent(activeSalesCode)}&returnId=${encodeURIComponent(returnIdParam)}&role=${encodeURIComponent(role)}`;
    const data = await apiFetch(url);
    const products = data.data || [];
    searchResultsCache = products;
    const dropdown = $('product-suggestions');
    if (!dropdown) return;

    if (products.length === 0) {
      dropdown.innerHTML = `<div class="suggestion-item"><div class="suggestion-name" style="color:var(--tg-hint)">Barang tidak ditemukan pada katalog sales ${escHtml(activeSalesCode || '')}</div></div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = products.map((p, idx) => {
      const uomsDesc = (p.uoms || []).map(u => {
        const hargaStr = u.harga ? `Rp ${Math.round(u.harga).toLocaleString('id-ID')}` : 'Rp 0';
        return `${escHtml(u.label)} (${hargaStr})`;
      }).join(' · ');

      return `
        <div class="suggestion-item" data-idx="${idx}">
          <div class="suggestion-name">${escHtml(p.nmbrg || p.kdbrg)}</div>
          <div class="suggestion-code">${escHtml(p.kdbrg)} ${uomsDesc ? `· ${uomsDesc}` : ''}</div>
        </div>
      `;
    }).join('');

    dropdown.querySelectorAll('.suggestion-item').forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.dataset.idx, 10);
        const product = searchResultsCache[idx];
        if (!product) return;
        modal.selectedProduct = product;
        renderSelectedProduct(product);
        renderUomCounters();
        dropdown.classList.add('hidden');
      };
    });

    dropdown.classList.remove('hidden');
  } catch (err) {
    console.warn('[searchProducts]', err);
  }
}

const btnClearProduct = $('btn-clear-product');
if (btnClearProduct) {
  btnClearProduct.onclick = () => {
    modal.selectedProduct = null;
    $('product-search-input').value = '';
    $('product-search-input').classList.remove('hidden');
    $('selected-product-display').classList.add('hidden');
    $('uom-counters-container').style.display = 'none';
    setTimeout(() => $('product-search-input').focus(), 50);
  };
}

// ──────────────────────────────────────────────────
// Barcode & QR Scanner
// ──────────────────────────────────────────────────
let html5QrCode = null;

async function startScanner() {
  $('modal-scanner').classList.remove('hidden');
  
  if (!html5QrCode && window.Html5Qrcode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  if (!html5QrCode) {
    alert('Library Scanner belum siap.');
    return;
  }

  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  
  try {
    await html5QrCode.start(
      { facingMode: "environment" }, 
      config,
      (decodedText) => {
        stopScanner();
        const searchInput = $('product-search-input');
        if (searchInput) {
          $('btn-clear-product')?.click();
          searchInput.value = decodedText;
          searchProducts(decodedText);
        }
      },
      () => {}
    );
  } catch (err) {
    console.error("Gagal memulai scanner:", err);
    alert("Gagal mengakses kamera. Pastikan Anda telah memberikan izin kamera.");
    stopScanner();
  }
}

function stopScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      $('modal-scanner').classList.add('hidden');
    }).catch(() => {
      $('modal-scanner').classList.add('hidden');
    });
  } else {
    $('modal-scanner').classList.add('hidden');
  }
}

const btnScanBarcode = $('btn-scan-barcode');
if (btnScanBarcode) btnScanBarcode.onclick = startScanner;

const btnScannerClose = $('btn-scanner-close');
if (btnScannerClose) btnScannerClose.onclick = stopScanner;

const modalScanner = $('modal-scanner');
if (modalScanner) {
  modalScanner.addEventListener('click', e => {
    if (e.target === modalScanner) stopScanner();
  });
}

// Alasan free-text sync
const alasanInput = $('alasan-input');
if (alasanInput) {
  alasanInput.addEventListener('input', () => {
    modal.selectedAlasan = alasanInput.value;
    document.querySelectorAll('.alasan-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.value === modal.selectedAlasan);
    });
  });
}

function showToast(message, duration = 2500) {
  let toast = $('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(17, 24, 39, 0.92);
      color: #fff;
      padding: 10px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
      opacity: 0;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(8px)';
  }, duration);
}

// Save modal
const btnModalSave = $('btn-modal-save');
if (btnModalSave) {
  btnModalSave.onclick = async () => {
    if (!modal.selectedProduct) {
      alert('Pilih barang terlebih dahulu.');
      return;
    }
    const alasan = $('alasan-input').value.trim();
    if (!alasan) {
      alert('Alasan retur harus diisi.');
      return;
    }

    const rows = document.querySelectorAll('.uom-card');
    let hasQty = false;
    const newItems = [];
    
    // Build map of existing items for this product by UOM label to preserve DB IDs
    const existingUomMap = {};
    state.items.forEach(it => {
      if (it.productCode === modal.selectedProduct.kdbrg && !it.deletedAt && it.id) {
        existingUomMap[it.uom] = it.id;
      }
    });

    rows.forEach((row, i) => {
      const qtyGood = parseInt($(`qtyGood-input-${i}`)?.value) || 0;
      const qtyBad = parseInt($(`qtyBad-input-${i}`)?.value) || 0;
      const qty = qtyGood + qtyBad;
      const uomLabel = row.dataset.label;
      const konversi = parseInt(row.dataset.konversi) || 1;
      const harga = parseFloat(row.dataset.harga) || 0;

      if (qty > 0) {
        hasQty = true;
        newItems.push({
          id: existingUomMap[uomLabel] || undefined,
          productCode: modal.selectedProduct.kdbrg,
          productName: modal.selectedProduct.nmbrg,
          uom: uomLabel,
          konversi: konversi,
          price: harga,
          totalPrice: qty * harga,
          qty: qty,
          qtyGood: qtyGood,
          qtyBad: qtyBad,
          alasan: alasan,
          _uoms: modal.selectedProduct.uoms
        });
      }
    });

    if (!hasQty) {
      alert('Minimal satu satuan (UOM) harus memiliki jumlah > 0 pada GOOD atau BAD.');
      return;
    }

    btnModalSave.disabled = true;
    btnModalSave.textContent = 'Menyimpan...';

    // Remove existing items with this productCode to prevent duplicates
    const isEditMode = typeof modal.editProductCode === 'string';
    if (isEditMode) {
      state.items = state.items.filter(it => it.productCode !== modal.editProductCode && it.productCode !== modal.selectedProduct.kdbrg);
    } else {
      state.items = state.items.filter(it => it.productCode !== modal.selectedProduct.kdbrg);
    }
    
    // Add new items
    state.items.push(...newItems);
    
    const isLocked = checkIsLocked();
    if (isLocked) {
      alert(state.status === 'SELESAI' ? 'Retur yang sudah disetujui Gudang telah dikunci permanen.' : 'Retur yang sudah disetujui tidak dapat diedit lagi.');
      btnModalSave.disabled = false;
      btnModalSave.textContent = 'Simpan';
      return;
    }

    // If editing existing return, persist directly to backend
    if (state.returnId && !isLocked) {
      try {
        const activeItems = state.items.filter(it => !it.deletedAt && it.qty > 0);
        const res = await apiFetch(`/retur/${state.returnId}/items`, {
          method: 'POST',
          body: JSON.stringify({ 
            items: activeItems, 
            role: state.simulatedRole,
            isFinal: false
          }),
        });
        if (res && res.data && res.data.items) {
          state.items = res.data.items.filter(it => !it.deletedAt).map(it => ({
            ...it,
            price: it.price,
            totalPrice: it.totalPrice,
            _uoms: [{ label: it.uom, konversi: it.konversi, harga: it.price || 0, price: it.price || 0 }]
          }));
        }
        showToast('✅ Barang berhasil disimpan');
      } catch (err) {
        alert('Gagal menyimpan ke server: ' + err.message);
      } finally {
        btnModalSave.disabled = false;
        btnModalSave.textContent = 'Simpan';
      }
    } else {
      btnModalSave.disabled = false;
      btnModalSave.textContent = 'Simpan';
      showToast('Barang ditambahkan');
    }

    closeModal();
    renderItemList();

    // Ensure step-2 next button is ready and enabled
    const btnNext = $('btn-step2-next');
    if (btnNext) {
      btnNext.disabled = false;
      if (state.returnId) {
        const isDriver = (state.simulatedRole === 'Driver/Kenek' || state.simulatedRole === 'Sopir');
        const isGudang = (state.simulatedRole === 'Admin Gudang');
        if (isDriver && state.status === 'SPV_APPROVED') {
          btnNext.textContent = '🚚 Selesaikan Penarikan Barang';
        } else if (isGudang) {
          btnNext.textContent = '💾 Simpan Perubahan (Gudang)';
        } else {
          btnNext.textContent = '💾 Simpan Perubahan';
        }
      }
    }
  };
}

const btnModalCancel = $('btn-modal-cancel');
if (btnModalCancel) btnModalCancel.onclick = closeModal;

const btnModalClose = $('btn-modal-close');
if (btnModalClose) btnModalClose.onclick = closeModal;

const modalOverlay = $('modal-overlay');
if (modalOverlay) {
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });
}

// ──────────────────────────────────────────────────
// Utils & Global Exports
// ──────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.openModal = openModal;
window.deleteItem = deleteItem;
window.selectReturn = selectReturn;
window.printReturn = printReturn;
window.deleteReturnData = deleteReturnData;

// ──────────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────────
init();
