const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const xlsx = require('xlsx');
const { getModelForRole, openai } = require('../utils/Orchestrator');
const { recordRateLimit, recordLLMSuccess } = require('../chatbot/MemoryManager');

// Setup public directory for knowledge base images
const KNOWLEDGE_DIR = path.join(__dirname, '../uploads/knowledge');
if (!fs.existsSync(KNOWLEDGE_DIR)) {
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
}

async function analyzeImageWithAI(base64Image) {
  try {
    const visionModel = await getModelForRole('VISION');
    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image. Extract all readable text, product names, prices, and provide a brief description. Format as Markdown.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } }
          ]
        }
      ]
    });
    recordLLMSuccess();
    let aiResponseText = response.choices[0].message.content;
    aiResponseText = aiResponseText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    return aiResponseText;
  } catch (error) {
    console.error('Vision API Error:', error);
    const errMsg = (error.error?.message || error.message || '').toLowerCase();
    const status = error.status || error.code;
    if (status === 429 || errMsg.includes('rate limit') || status === 402 || errMsg.includes('credit') || errMsg.includes('billing')) {
      recordRateLimit();
    }
    throw new Error('Gagal mengekstrak teks menggunakan AI Vision.');
  }
}

exports.uploadKnowledge = async (req, res) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, mimetype, path: filePath } = req.file;
    tempFilePath = filePath;
    const baseName = path.parse(originalname).name;

    // 1. Process Excel/CSV
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimetype === 'application/vnd.ms-excel' ||
      mimetype === 'text/csv'
    ) {
      const workbook = xlsx.readFile(filePath);
      let extractedText = '';
      workbook.SheetNames.forEach((sheetName) => {
        const xlData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        extractedText += `Sheet: ${sheetName}\n`;
        extractedText += JSON.stringify(xlData, null, 2) + '\n\n';
      });

      const newKnowledge = await prisma.productKnowledge.create({
        data: {
          title: originalname,
          fileType: 'spreadsheet',
          content: extractedText
        }
      });
      return res.status(201).json({ success: true, data: [newKnowledge] });
    }

    // 2. Process TXT
    if (mimetype === 'text/plain') {
      const extractedText = fs.readFileSync(filePath, 'utf8');
      const newKnowledge = await prisma.productKnowledge.create({
        data: {
          title: originalname,
          fileType: 'text',
          content: extractedText
        }
      });
      return res.status(201).json({ success: true, data: [newKnowledge] });
    }

    // 3. Process PDF using Vision AI
    if (mimetype === 'application/pdf') {
      const timestamp = Date.now();
      const uniqueBase = `${timestamp}-${baseName.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`;
      
      const command = `convert -density 150 "${filePath}" "${path.join(KNOWLEDGE_DIR, `${uniqueBase}-page%03d.png`)}"`;
      await execPromise(command);
      
      const files = fs.readdirSync(KNOWLEDGE_DIR);
      const generatedFiles = files
        .filter(f => f.startsWith(`${uniqueBase}-page`) && f.endsWith('.png'))
        .sort();
      
      const createdEntries = [];
      for (let i = 0; i < generatedFiles.length; i++) {
        const imgName = generatedFiles[i];
        const imgPath = path.join(KNOWLEDGE_DIR, imgName);
        
        const base64 = fs.readFileSync(imgPath, 'base64');
        const aiText = await analyzeImageWithAI(base64);
        const relativeUrl = '/uploads/knowledge/' + imgName;
        
        const newKnowledge = await prisma.productKnowledge.create({
          data: {
            title: `${originalname} - Page ${i + 1}`,
            fileType: 'image',
            content: aiText,
            mediaUrl: relativeUrl
          }
        });
        createdEntries.push(newKnowledge);
      }
      return res.status(201).json({ success: true, data: createdEntries });
    }

    // 4. Process Images using Vision AI
    if (mimetype.startsWith('image/')) {
      const ext = path.extname(originalname) || '.png';
      const newFileName = `${Date.now()}-${baseName.substring(0, 10)}${ext}`;
      const newPath = path.join(KNOWLEDGE_DIR, newFileName);
      
      // Move temp file to knowledge dir
      fs.copyFileSync(filePath, newPath);
      const relativeUrl = '/uploads/knowledge/' + newFileName;
      
      const base64 = fs.readFileSync(newPath, 'base64');
      const aiText = await analyzeImageWithAI(base64);
      
      const newKnowledge = await prisma.productKnowledge.create({
        data: {
          title: originalname,
          fileType: 'image',
          content: aiText,
          mediaUrl: relativeUrl
        }
      });
      
      return res.status(201).json({ success: true, data: [newKnowledge] });
    }

    return res.status(400).json({ error: `Unsupported file type: ${mimetype}` });

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'Server error during extraction' });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch(e) {
        console.error('Failed to delete temp file', e);
      }
    }
  }
};

exports.getKnowledgeBase = async (req, res) => {
  try {
    const data = await prisma.productKnowledge.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(data);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge base' });
  }
};

exports.deleteKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await prisma.productKnowledge.findUnique({ where: { id } });
    
    if (entry && entry.mediaUrl) {
      const filePath = path.join(__dirname, '../', entry.mediaUrl);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to delete media file:', e);
        }
      }
    }
    
    await prisma.productKnowledge.delete({ where: { id } });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
};
