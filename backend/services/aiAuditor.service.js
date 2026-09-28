const { PrismaClient } = require('@prisma/client');
const { getModelForRole, openai } = require('../utils/Orchestrator');
const prisma = new PrismaClient();

const fetchFreshData = async (sourceModule, queryParameters) => {
  // Dispatcher based on source module
  if (sourceModule === 'GROUP_ANALYSIS') {
    const { sessionId, groupId, dateFrom, dateTo } = queryParameters;
    
    // As a PoC, we will just fetch the count of messages in the group
    // In a real scenario, we would duplicate or extract the complex logic from groupAnalysis.js
    const groupIdClean = groupId.split('@')[0];
    const timestampFilter = {};
    if (dateFrom) timestampFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      timestampFilter.lte = endDate;
    }

    const messagesCount = await prisma.message.count({
      where: {
        sessionId: sessionId,
        OR: [
          { sender: groupIdClean },
          { receiver: groupIdClean }
        ],
        isStatus: false,
        ...(Object.keys(timestampFilter).length > 0 ? { timestamp: timestampFilter } : {})
      }
    });

    return {
      message: "Data fetched successfully from GROUP_ANALYSIS",
      messagesCount,
      timestamp: new Date().toISOString()
    };
  }

  // Fallback mock fetcher
  return {
    message: "Mock data fetched for " + sourceModule,
    timestamp: new Date().toISOString(),
    status: "Active"
  };
};

const generateProgressReport = async (taskId) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { issue: true }
  });

  if (!task) {
    throw new Error('Task not found');
  }

  const { issue } = task;

  // 1. Fetch fresh data based on the issue parameters
  let currentSnapshot;
  try {
    // Parse queryParameters if it's a string, otherwise use directly
    const params = typeof issue.queryParameters === 'string' ? JSON.parse(issue.queryParameters) : issue.queryParameters;
    currentSnapshot = await fetchFreshData(issue.sourceModule, params);
  } catch (err) {
    console.error("Error fetching fresh data", err);
    currentSnapshot = { error: "Failed to fetch fresh data", details: err.message };
  }

  // 2. Compare with AI
  let aiProgressReport = "Gagal membuat laporan progress.";
  try {
    const analyticalModel = await getModelForRole('ANALYTICAL');
    const systemPrompt = `Anda adalah asisten AI Auditor operasional.
Tugas Anda adalah membandingkan kondisi awal (Initial Snapshot) sebuah issue dengan kondisi saat ini (Current Snapshot).
Issue: ${issue.title}

Initial Snapshot:
${JSON.stringify(issue.initialSnapshot, null, 2)}

Current Snapshot:
${JSON.stringify(currentSnapshot, null, 2)}

Initial AI Summary:
${issue.aiSummary || 'Tidak ada'}

Buatlah laporan ringkas (Progress Report) yang menyoroti:
1. Apa saja yang berubah/berkembang?
2. Apakah ada anomali atau hal yang perlu diwaspadai?
3. Kesimpulan status saat ini.`;

    const completion = await openai.chat.completions.create({
      model: analyticalModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Tolong buatkan progress report sekarang.' }
      ],
      temperature: 0.3,
    });

    if (completion.choices && completion.choices.length > 0) {
      aiProgressReport = completion.choices[0]?.message?.content || "Analisa AI kosong.";
      aiProgressReport = aiProgressReport.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }
  } catch (aiError) {
    console.error("Error generating AI progress report:", aiError);
    aiProgressReport = `Gagal menganalisa progress: ${aiError.message}`;
  }

  // 3. Update the task
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      currentSnapshot,
      aiProgressReport,
      updatedAt: new Date()
    }
  });

  return updatedTask;
};

module.exports = {
  generateProgressReport
};
