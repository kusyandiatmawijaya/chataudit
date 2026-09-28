const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const fetchActiveModels = async (req, res) => {
  try {
    const models = await prisma.listAIModel.findMany({
      where: { isActive: true, isAvailable: true },
      orderBy: [
        { isFree: 'asc' },
        { name: 'asc' }
      ]
    });
    res.json({ success: true, data: models });
  } catch (error) {
    console.error('Error fetching AI models:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar model AI' });
  }
};
const fetchAllModels = async (req, res) => {
  try {
    const models = await prisma.listAIModel.findMany({
      orderBy: [
        { isFree: 'asc' },
        { name: 'asc' }
      ]
    });
    res.json({ success: true, data: models });
  } catch (error) {
    console.error('Error fetching all AI models:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil seluruh daftar model AI' });
  }
};

const toggleModelStatus = async (req, res) => {
  try {
    const { modelId } = req.body;
    
    const existing = await prisma.listAIModel.findUnique({ where: { modelId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Model tidak ditemukan' });
    }

    const updated = await prisma.listAIModel.update({
      where: { modelId },
      data: { isActive: !existing.isActive }
    });

    res.json({ success: true, data: updated, message: `Model ${updated.name} ${updated.isActive ? 'diaktifkan' : 'dinonaktifkan'}` });
  } catch (error) {
    console.error('Error toggling model status:', error);
    res.status(500).json({ success: false, message: 'Gagal mengubah status model AI' });
  }
};

const syncModelsFromOpenRouter = async () => {
  try {
    console.log("Starting OpenRouter models sync...");
    const response = await axios.get('https://openrouter.ai/api/v1/models');
    if (!response.data || !response.data.data) {
      console.error("Invalid response from OpenRouter");
      return;
    }
    
    const apiModels = response.data.data;
    
    // Default active models based on what was used in the previous hardcoded list
    const defaultActiveModels = [
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
      'google/gemini-2.5-flash-lite-preview',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'anthropic/claude-3-haiku',
      'anthropic/claude-3.5-sonnet',
      'nvidia/nemotron-4-340b-instruct',
      'meta-llama/llama-3.1-8b-instruct',
      // FREE
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'google/gemini-2.0-flash-lite-preview-02-05:free',
      'google/gemini-2.0-pro-exp-02-05:free',
      'mistralai/mistral-small-24b-instruct-2501:free',
      'mistralai/mistral-7b-instruct:free',
      'deepseek/deepseek-r1:free',
      'deepseek/deepseek-chat:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'microsoft/phi-4:free',
      'google/gemma-3-27b-it:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      // NEW FREE MODELS
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'google/gemma-4-31b-it:free',
      'meta-llama/llama-4-maverick:free',
      'qwen/qwen3-coder:free',
      'poolside/laguna-m.1:free',
      'openai/gpt-oss-120b:free',
      'openai/gpt-oss-20b:free',
      'openrouter/free'
    ];

    // Mark all models as unavailable first.
    await prisma.listAIModel.updateMany({
      data: { isAvailable: false }
    });

    let count = 0;
    const batchSize = 25;
    for (let i = 0; i < apiModels.length; i += batchSize) {
      const chunk = apiModels.slice(i, i + batchSize);
      await Promise.all(chunk.map(async (m) => {
        const isFree = parseFloat(m.pricing?.prompt || 0) === 0 && parseFloat(m.pricing?.completion || 0) === 0;
        let badge = null;
        if (isFree) badge = 'FREE';
        
        const isActive = defaultActiveModels.includes(m.id);

        // Check multimodal capability
        let isMultimodal = false;
        if (m.architecture) {
          const modalityString = m.architecture.modality || '';
          const inputModalities = m.architecture.input_modalities || [];
          if (
            modalityString.toLowerCase().includes('image') ||
            modalityString.toLowerCase().includes('vision') ||
            inputModalities.some(mod => mod.toLowerCase() === 'image' || mod.toLowerCase() === 'vision')
          ) {
            isMultimodal = true;
          }
        }

        await prisma.listAIModel.upsert({
          where: { modelId: m.id },
          update: {
            name: m.name,
            isFree: isFree,
            contextLength: m.context_length,
            isAvailable: true,
            isMultimodal: isMultimodal
          },
          create: {
            modelId: m.id,
            name: m.name,
            badge: badge,
            isFree: isFree,
            contextLength: m.context_length,
            isActive: isActive,
            isAvailable: true,
            isMultimodal: isMultimodal
          }
        });
        count++;
      }));
    }
    console.log(`Synced ${count} models from OpenRouter.`);
  } catch (error) {
    console.error("Error syncing models from OpenRouter:", error.message);
  }
};

module.exports = {
  fetchActiveModels,
  fetchAllModels,
  toggleModelStatus,
  syncModelsFromOpenRouter
};
