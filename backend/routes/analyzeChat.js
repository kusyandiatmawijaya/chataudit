const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { getModelForRole, openai } = require('../utils/Orchestrator');
const { recordRateLimit, recordLLMSuccess } = require('../chatbot/MemoryManager');

const prisma = new PrismaClient();
const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '../uploads');

router.post('/', async (req, res) => {
  let defaultModel = 'meta-llama/llama-3.3-70b-instruct';
  try {
    const { sessionId, contactNumber, userPrompt, dateFrom, dateTo, includeMedia = true } = req.body;
    if (!sessionId || !contactNumber || !userPrompt) {
      return res.status(400).json({ success: false, error: 'Missing sessionId, contactNumber or userPrompt' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ success: false, error: 'GROQ_API_KEY is not configured' });
    }

    const timestampFilter = {};
    if (dateFrom) timestampFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      timestampFilter.lte = endDate;
    }

    let messages = await prisma.message.findMany({
      where: {
        sessionId: sessionId,
        OR: [
          { sender: contactNumber },
          { receiver: contactNumber }
        ],
        isStatus: false,
        ...(Object.keys(timestampFilter).length > 0 ? { timestamp: timestampFilter } : {})
      },
      orderBy: { timestamp: 'desc' },
      take: 200
    });

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        errorType: 'NO_MESSAGES',
        error: 'Tidak ada pesan ditemukan',
        details: dateFrom || dateTo
          ? 'Tidak ada pesan dalam rentang tanggal yang dipilih. Coba perluas periode analisa.'
          : 'Tidak ada pesan ditemukan untuk kontak ini.',
        action: 'RETRY'
      });
    }

    const recentImageIds = new Set();
    let tierSetting = await prisma.appSetting.findUnique({ where: { key: 'orchestration_tier' } });
    const isFreeTier = !tierSetting || tierSetting.value !== 'PAID';
    const MAX_IMAGES = isFreeTier ? 2 : 10;
    
    if (includeMedia) {
      let foundImages = 0;
      for (const msg of messages) {
        if (msg.mediaUrl && msg.mediaType && (msg.mediaType === 'image/jpeg' || msg.mediaType === 'image/png')) {
          const filename = path.basename(msg.mediaUrl);
          const filePath = path.join(UPLOADS_DIR, filename);
          if (fs.existsSync(filePath)) {
            recentImageIds.add(msg.id);
            foundImages++;
            if (foundImages >= MAX_IMAGES) break;
          }
        }
      }
    }

    messages = messages.reverse();

    const transcriptLines = [];
    const imageContents = [];
    let totalTranscriptChars = 0;
    const MAX_TRANSCRIPT_CHARS = isFreeTier 
      ? (includeMedia ? 5000 : 8000) 
      : (includeMedia ? 12000 : 24000); 

    for (const msg of messages) {
      const person = msg.isFromMe ? 'Me' : (msg.authorName || msg.sender);
      let text = `${person}: ${msg.messageBody}`;

      if (includeMedia && msg.mediaUrl && msg.mediaType) {
        const filename = path.basename(msg.mediaUrl);
        const filePath = path.join(UPLOADS_DIR, filename);
        
        if (fs.existsSync(filePath)) {
          if (msg.mediaType === 'application/pdf') {
            if (filename.startsWith('Report_')) {
              text += `\n[Automated PDF Report omitted]`;
            } else {
              try {
                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await pdfParse(dataBuffer);
                const truncatedText = pdfData.text.length > 3000 ? pdfData.text.substring(0, 3000) + '... [truncated]' : pdfData.text;
                text += `\n[PDF Extracted Text]:\n${truncatedText}`;
              } catch (err) {
                console.error('Error parsing PDF:', err);
                text += `\n[Failed to read PDF file]`;
              }
            }
          } else if (msg.mediaType === 'image/jpeg' || msg.mediaType === 'image/png') {
            if (recentImageIds.has(msg.id)) {
              try {
                const imageBuffer = fs.readFileSync(filePath);
                const base64Image = imageBuffer.toString('base64');
                imageContents.push({
                  type: 'image_url',
                  image_url: {
                    url: `data:${msg.mediaType};base64,${base64Image}`
                  }
                });
                text += `\n[Image attached]`;
              } catch (err) {
                console.error('Error reading image:', err);
              }
            } else {
              text += `\n[Image omitted to prioritize newer images]`;
            }
          }
        }
      }
      totalTranscriptChars += text.length;
      transcriptLines.push(text);
      if (totalTranscriptChars >= MAX_TRANSCRIPT_CHARS) break; 
    }

    const transcript = transcriptLines.join('\n');

    const dictionaries = await prisma.dictionary.findMany();
    let dictionaryContext = "";
    if (dictionaries.length > 0) {
      dictionaryContext = "Here is the business jargon dictionary that you MUST use to understand the context:\n";
      dictionaries.forEach(d => {
        dictionaryContext += `- ${d.term}: ${d.definition}\n`;
      });
      dictionaryContext += "\n";
    }

    const visionModel = await getModelForRole('VISION');
    const analyticalModel = await getModelForRole('ANALYTICAL');

    defaultModel = analyticalModel;

    let responseText = "";

    if (imageContents.length > 0) {
      const analysisResults = [];
      for (let i = 0; i < imageContents.length; i++) {
        const promptText = `Instruction: ${userPrompt}\n\nIMPORTANT: Focus ONLY on extracting data from the attached image according to the instruction. Do not include any unrelated sections or templates (like "RINGKASAN EKSEKUTIF").\n\n${dictionaryContext}For context, here is the chat transcript:\n${transcript}`;
        
        const groqContent = [
          { type: 'text', text: promptText },
          imageContents[i]
        ];

        let modelForImage = visionModel;

        const chatCompletion = await openai.chat.completions.create({
          messages: [{ role: 'user', content: groqContent }],
          model: modelForImage,
          max_tokens: 2048,
        });
        
        let resText = chatCompletion.choices[0]?.message?.content || "";
        resText = resText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        analysisResults.push(`Data from Image ${i+1}:\n${resText}`);
      }
      
      const combinePrompt = `You are a helpful assistant compiling extracted data. 
I have extracted data from ${imageContents.length} images based on this instruction: "${userPrompt}"

Here are the individual extractions:
${analysisResults.join('\n\n---\n\n')}

Please combine them into a single cohesive response (e.g., a single unified table if requested) exactly as the user asked. DO NOT add any extra sections like "RINGKASAN EKSEKUTIF" atau "PRIORITAS & TINDAK LANJUT". Just provide the combined data directly.`;

      const combineCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: combinePrompt }],
        model: defaultModel,
        max_tokens: 2048,
      });
      
      responseText = combineCompletion.choices[0]?.message?.content || "";
      responseText = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      recordLLMSuccess();
    } else {
      const promptText = `Instruction: ${userPrompt}\n\nIMPORTANT: Only answer what is requested. Do not include any unrelated sections or templates (like "RINGKASAN EKSEKUTIF") unless explicitly asked.\n\n${dictionaryContext}Here is the chat transcript:\n${transcript}`;
      
      const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: [{ type: 'text', text: promptText }] }],
        model: defaultModel,
        max_tokens: 2048,
      });
      responseText = chatCompletion.choices[0]?.message?.content || "";
      responseText = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      recordLLMSuccess();
    }

    res.json({ success: true, analysis: responseText, messageCount: messages.length, modelUsed: defaultModel });
  } catch (error) {
    console.error('Error in AI Chat Analysis:', error);

    const status = error.status || error.code;
    const errMsg = (error.error?.message || error.message || '').toLowerCase();

    if (status === 402 || errMsg.includes('credit') || errMsg.includes('afford') || errMsg.includes('billing')) {
      recordRateLimit();
      return res.status(402).json({
        success: false,
        errorType: 'INSUFFICIENT_CREDITS',
        modelName: defaultModel,
        error: 'Saldo kredit OpenRouter tidak mencukupi',
        details: 'Akun OpenRouter Anda kehabisan kredit. Silakan top-up di openrouter.ai/settings/credits.',
        action: 'TOP_UP_OR_CHANGE_MODEL'
      });
    }

    if (status === 429 || errMsg.includes('rate limit') || errMsg.includes('too many requests') || errMsg.includes('ratelimit')) {
      recordRateLimit();
      return res.status(429).json({
        success: false,
        errorType: 'RATE_LIMIT',
        modelName: defaultModel,
        error: 'Terlalu banyak permintaan ke AI (Rate Limit)',
        details: 'Model AI sedang membatasi jumlah permintaan. Tunggu beberapa detik lalu coba lagi.',
        action: 'RETRY_LATER'
      });
    }

    if (
      errMsg.includes('context') || errMsg.includes('token') ||
      errMsg.includes('max_tokens') || errMsg.includes('too long') ||
      errMsg.includes('length') || errMsg.includes('context_length_exceeded') ||
      status === 'context_length_exceeded'
    ) {
      return res.status(413).json({
        success: false,
        errorType: 'CONTEXT_TOO_LONG',
        modelName: defaultModel,
        error: 'Percakapan terlalu panjang untuk diproses model ini',
        details: 'Model AI yang dipilih tidak dapat memproses jumlah pesan sebanyak ini. Coba persempit rentang tanggal.',
        action: 'REDUCE_CONTEXT'
      });
    }

    if (status === 401 || errMsg.includes('invalid api key') || errMsg.includes('unauthorized') || errMsg.includes('authentication')) {
      return res.status(401).json({
        success: false,
        errorType: 'INVALID_API_KEY',
        modelName: defaultModel,
        error: 'API Key OpenRouter tidak valid atau sudah kadaluarsa',
        details: 'Periksa kembali OPENROUTER_API_KEY di pengaturan server.',
        action: 'CHECK_API_KEY'
      });
    }

    if (status === 503 || errMsg.includes('overloaded') || errMsg.includes('unavailable') || errMsg.includes('service')) {
      return res.status(503).json({
        success: false,
        errorType: 'MODEL_UNAVAILABLE',
        modelName: defaultModel,
        error: 'Model AI sedang tidak tersedia atau kelebihan beban',
        details: 'Server model AI sedang overload. Coba lagi dalam beberapa menit.',
        action: 'RETRY_LATER'
      });
    }

    res.status(500).json({
      success: false,
      errorType: 'UNKNOWN',
      modelName: defaultModel,
      error: 'Gagal menjalankan analisis AI',
      details: error.message || 'Terjadi kesalahan tidak terduga. Silakan coba lagi.',
      action: 'RETRY'
    });
  }
});

module.exports = router;
