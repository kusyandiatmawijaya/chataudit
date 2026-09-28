// backend/utils/activeUserTracker.js
// Melacak user yang aktif berdasarkan aktivitas API request (JWT).
// Setiap kali user membuat request terautentikasi, "last seen" mereka diperbarui.
// User dianggap tidak aktif jika tidak ada request dalam SESSION_TIMEOUT_MS menit.

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 menit

// Map: userId → { id, username, role, lastSeen: Date }
const _activeUsers = new Map();

/**
 * Dipanggil oleh authenticateToken middleware setiap kali request JWT valid.
 * @param {object} user - Payload JWT: { id, username, role, ... }
 */
function recordActivity(user) {
  if (!user?.id) return;
  _activeUsers.set(user.id, {
    id       : user.id,
    username : user.username || 'Unknown',
    role     : user.role || '-',
    lastSeen : new Date(),
  });
}

/**
 * Mengembalikan array user yang masih dianggap aktif
 * (punya request dalam SESSION_TIMEOUT_MS terakhir).
 * Sekaligus membersihkan entri yang sudah kedaluwarsa.
 */
function getActiveUsers() {
  const cutoff = Date.now() - SESSION_TIMEOUT_MS;
  for (const [id, info] of _activeUsers.entries()) {
    if (info.lastSeen.getTime() < cutoff) {
      _activeUsers.delete(id);
    }
  }
  return [..._activeUsers.values()];
}

/** Jumlah user aktif saat ini */
function getActiveUserCount() {
  return getActiveUsers().length;
}

module.exports = { recordActivity, getActiveUsers, getActiveUserCount };
