// backend/chatbot/MemoryManager.js

const chatMemory = new Map();
const MAX_MEMORY = 10;
const pollCache = new Map(); // Stores poll creation messages for decoding
const userState = new Map();

const STATE_IDLE = 'IDLE';
const STATE_FALLBACK_MENU = 'FALLBACK_MENU';
const STATE_WAITING_AR = 'WAITING_FOR_AR_STORE_CODE';
const STATE_WAITING_REGISTER_INFO = 'WAITING_REGISTER_INFO';
const STATE_WAITING_OTP = 'WAITING_OTP';
const STATE_WAITING_STORE_NAME_TIDAK_TERIMA = 'WAITING_STORE_NAME_TIDAK_TERIMA';
const STATE_WAITING_REPORT_SELECTION = 'WAITING_REPORT_SELECTION';

const registrationSessions = new Map();


function getUserState(remoteJid) {
  return userState.get(remoteJid) || STATE_IDLE;
}

function setUserState(remoteJid, state) {
  userState.set(remoteJid, state);
}

function clearUserState(remoteJid) {
  userState.delete(remoteJid);
}

function getMemory(remoteJid) {
  return chatMemory.get(remoteJid) || [];
}

function addToMemory(remoteJid, role, content) {
  const history = chatMemory.get(remoteJid) || [];
  history.push({ role, content });

  // Keep only the last MAX_MEMORY messages
  if (history.length > MAX_MEMORY) {
    history.splice(0, history.length - MAX_MEMORY);
  }

  chatMemory.set(remoteJid, history);
}

function clearMemory(remoteJid) {
  chatMemory.delete(remoteJid);
}

// ─────────────────────────────────────────────────
//  RATE-LIMIT TRACKER
//  Digunakan oleh AIResponder untuk mencatat kapan
//  terakhir kali AI terkena rate-limit, dan dibaca
//  oleh IT Status menu di MessageHandler.
// ─────────────────────────────────────────────────

let _lastRateLimitAt = null;   // Date object | null
let _rateLimitCount  = 0;      // total hits since server start
let _lastSuccessAt   = null;   // Date object | null — last successful LLM call

/** Dipanggil oleh AIResponder saat LLM mengembalikan HTTP 429 */
function recordRateLimit() {
  _lastRateLimitAt = new Date();
  _rateLimitCount++;
}

/** Dipanggil oleh AIResponder setelah LLM berhasil membalas */
function recordLLMSuccess() {
  _lastSuccessAt = new Date();
}

/** Mengembalikan info rate-limit untuk ditampilkan ke menu IT */
function getRateLimitInfo() {
  return {
    lastRateLimitAt : _lastRateLimitAt,
    rateLimitCount  : _rateLimitCount,
    lastSuccessAt   : _lastSuccessAt,
  };
}

module.exports = {
  chatMemory,
  pollCache,
  userState,
  STATE_IDLE,
  STATE_FALLBACK_MENU,
  STATE_WAITING_AR,
  STATE_WAITING_REGISTER_INFO,
  STATE_WAITING_OTP,
  STATE_WAITING_STORE_NAME_TIDAK_TERIMA,
  STATE_WAITING_REPORT_SELECTION,
  getUserState,
  setUserState,
  clearUserState,
  registrationSessions,
  getMemory,
  addToMemory,
  clearMemory,
  // Rate-limit tracker
  recordRateLimit,
  recordLLMSuccess,
  getRateLimitInfo,
};
