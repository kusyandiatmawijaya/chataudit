const { PrismaClient } = require('@prisma/client');
const { OpenAI } = require('openai');
require('dotenv').config();

const prisma = new PrismaClient();

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Definisi Model Spesialis berdasarkan Tier
const MODELS = {
  FREE: {
    ROUTER: 'google/gemini-2.5-flash-lite-preview', // Cepat
    ANALYTICAL: 'deepseek/deepseek-r1', // Logika
    PERSONA: 'google/gemma-3-27b-it:free', // Tone & Empati
    VISION: 'google/gemini-2.0-pro-exp-02-05:free' // OCR & Panjang
  },
  PAID: {
    ROUTER: 'anthropic/claude-3-haiku', // Cepat & Presisi
    ANALYTICAL: 'anthropic/claude-sonnet-5', // Raja Tool-Calling
    PERSONA: 'anthropic/claude-sonnet-5', // Sangat natural
    VISION: 'anthropic/claude-sonnet-5' // Ekstraksi Data
  }
};

/**
 * Mengambil tier orkestrasi dari pengaturan (AppSetting).
 * Default adalah 'FREE' jika belum diatur.
 */
async function getOrchestrationTier() {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'orchestration_tier' } });
    if (setting && setting.value) {
      return setting.value.toUpperCase() === 'PAID' ? 'PAID' : 'FREE';
    }
  } catch (error) {
    console.error('[Orchestrator] Error fetching orchestration_tier:', error);
  }
  return 'FREE'; // Fallback
}

/**
 * Memilih model terbaik untuk suatu role berdasarkan tier saat ini.
 * Memprioritaskan konfigurasi di AppSetting, fallback ke pengaturan bawaan (MODELS).
 * Role yang didukung: 'ROUTER', 'ANALYTICAL', 'PERSONA', 'VISION'
 */
async function getModelForRole(role) {
  const tier = await getOrchestrationTier(); // 'FREE' or 'PAID'
  const selectedRole = role.toUpperCase();
  
  // Mencari konfigurasi dinamis dari database (contoh key: orchestration_model_free_router)
  const settingKey = `orchestration_model_${tier.toLowerCase()}_${selectedRole.toLowerCase()}`;
  let dynamicModel = null;
  
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });
    if (setting && setting.value) {
      dynamicModel = setting.value;
    }
  } catch (error) {
    console.error(`[Orchestrator] Error fetching dynamic model for ${settingKey}:`, error);
  }

  if (dynamicModel) {
    return dynamicModel;
  }

  // Fallback ke konstanta bawaan
  if (!MODELS[tier] || !MODELS[tier][selectedRole]) {
    console.warn(`[Orchestrator] Role ${selectedRole} not found for tier ${tier}. Using fallback.`);
    return tier === 'PAID' ? 'openai/gpt-4o-mini' : 'meta-llama/llama-3.1-8b-instruct:free';
  }
  
  return MODELS[tier][selectedRole];
}

/**
 * Helper untuk melakukan completion menggunakan model spesialis tertentu.
 */
async function getCompletion(role, messages, options = {}) {
  const model = await getModelForRole(role);
  
  const payload = {
    model,
    messages,
    max_tokens: options.max_tokens || 1024,
    temperature: options.temperature !== undefined ? options.temperature : 0.7,
    ...options
  };

  try {
    const response = await openai.chat.completions.create(payload);
    return response;
  } catch (error) {
    console.error(`[Orchestrator] Failed completion for role ${role} (Model: ${model}):`, error.message);
    throw error;
  }
}

module.exports = {
  openai,
  getOrchestrationTier,
  getModelForRole,
  getCompletion,
  MODELS
};
