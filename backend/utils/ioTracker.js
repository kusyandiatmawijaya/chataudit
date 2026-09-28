// backend/utils/ioTracker.js
// Shared module untuk mengekspos jumlah koneksi Socket.IO aktif
// (proxy untuk "user yang sedang membuka dashboard").
//
// Cara pakai:
//   server.js  → setIO(io)   setelah io dibuat
//   lain-lain  → getActiveWebUsers()

let _io = null;

/** Dipanggil dari server.js setelah io diinisialisasi */
function setIO(io) {
  _io = io;
}

/**
 * Mengembalikan jumlah koneksi Socket.IO yang aktif saat ini.
 * Setiap browser tab yang membuka dashboard = 1 koneksi.
 * Mengembalikan null jika io belum diset.
 */
function getActiveWebUsers() {
  if (!_io) return null;
  // io.engine.clientsCount = total raw transport connections
  return _io.engine?.clientsCount ?? _io.sockets?.sockets?.size ?? null;
}

function getIO() {
  return _io;
}

module.exports = { setIO, getActiveWebUsers, getIO };
