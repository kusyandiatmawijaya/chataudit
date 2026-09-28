const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { getCompletion } = require('../utils/Orchestrator');
const { authenticateToken } = require('../middleware/auth');

// Middleware to protect these routes
router.use(authenticateToken);

// GET all data sources
router.get('/', async (req, res) => {
  try {
    const dataSources = await prisma.dataSource.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(dataSources);
  } catch (error) {
    console.error('Error fetching data sources:', error);
    res.status(500).json({ error: 'Failed to fetch data sources' });
  }
});

// POST a new data source
router.post('/', async (req, res) => {
  try {
    const { name, description, query, widgetTypes, dynamicParams } = req.body;
    
    // widgetTypes could be sent as an array, store as stringified JSON
    const widgetTypesStr = Array.isArray(widgetTypes) ? JSON.stringify(widgetTypes) : widgetTypes;

    const newDataSource = await prisma.dataSource.create({
      data: {
        name,
        description,
        query,
        widgetTypes: widgetTypesStr,
        dynamicParams: dynamicParams !== undefined ? dynamicParams : "tahun,bulan"
      }
    });

    res.status(201).json(newDataSource);
  } catch (error) {
    console.error('Error creating data source:', error);
    res.status(500).json({ error: 'Failed to create data source', details: error.message });
  }
});

// PUT update a data source
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, query, widgetTypes, dynamicParams } = req.body;

    const widgetTypesStr = Array.isArray(widgetTypes) ? JSON.stringify(widgetTypes) : widgetTypes;

    const updatedDataSource = await prisma.dataSource.update({
      where: { id },
      data: {
        name,
        description,
        query,
        widgetTypes: widgetTypesStr,
        dynamicParams
      }
    });

    res.json(updatedDataSource);
  } catch (error) {
    console.error('Error updating data source:', error);
    res.status(500).json({ error: 'Failed to update data source' });
  }
});

// DELETE a data source
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.dataSource.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting data source:', error);
    res.status(500).json({ error: 'Failed to delete data source' });
  }
});

// POST generate SQL using AI
router.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Read schema.prisma to provide context
    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
    let schemaContent = '';
    try {
      schemaContent = fs.readFileSync(schemaPath, 'utf8');
    } catch (err) {
      console.error('Failed to read schema.prisma:', err);
      return res.status(500).json({ error: 'Failed to load database schema for AI context' });
    }

    const systemMessage = `
You are an expert PostgreSQL DBA and Data Analyst.
Your task is to generate a raw PostgreSQL query based on the user's request.
The query will be used as a Data Source for a Dashboard Widget.

RULES:
1. ONLY return the raw SQL query. Do NOT use markdown code blocks (like \`\`\`sql ... \`\`\`).
2. Do NOT include any explanations or conversational text.
3. The query MUST be safe for read-only operations (SELECT only). Do NOT include INSERT, UPDATE, DELETE, DROP, ALTER, etc.
4. Ensure the query returns results compatible with standard charting tools (e.g., aggregating by a dimension like date, month, or category, and providing metric values).
5. If the user asks for date filtering, use PostgreSQL functions or assume no filtering if not explicitly provided (the frontend will handle date boundaries later if needed).

Here is the Prisma Schema of the database:
${schemaContent}
`;

    const messages = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ];

    const response = await getCompletion('ANALYTICAL', messages, { temperature: 0.2 });
    
    let generatedSql = response.choices[0]?.message?.content || '';
    
    // Sometimes the LLM includes <think> blocks (like deepseek-r1), we should remove them
    generatedSql = generatedSql.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // Sometimes they still use markdown blocks despite instructions
    generatedSql = generatedSql.replace(/^```[a-z]*\n/i, '').replace(/```$/i, '').trim();

    res.json({ query: generatedSql });
  } catch (error) {
    console.error('Error generating SQL:', error);
    res.status(500).json({ error: 'Failed to generate SQL query', details: error.message });
  }
});

// GET database tables and columns
router.get('/tables', async (req, res) => {
  try {
    const columns = await prisma.$queryRaw`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `;
    
    // Group by table
    const tables = {};
    columns.forEach(col => {
      if (!tables[col.table_name]) {
        tables[col.table_name] = [];
      }
      tables[col.table_name].push({ name: col.column_name, type: col.data_type });
    });

    res.json(tables);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: 'Failed to fetch database schema' });
  }
});

// POST run query to preview results
router.post('/run', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Basic protection against destructive queries
    const upperQuery = query.toUpperCase();
    if (upperQuery.includes('DROP ') || upperQuery.includes('DELETE ') || upperQuery.includes('UPDATE ') || upperQuery.includes('INSERT ') || upperQuery.includes('ALTER ') || upperQuery.includes('TRUNCATE ')) {
      return res.status(400).json({ error: 'Only SELECT queries are allowed in preview' });
    }

    let results = await prisma.$queryRawUnsafe(query);
    
    // Auto-flatten logic for single-column JSON returns
    if (Array.isArray(results) && results.length > 0) {
      const keys = Object.keys(results[0]);
      if (keys.length === 1) {
        const firstVal = results[0][keys[0]];
        if (firstVal !== null && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
          results = results.map(row => row[keys[0]]);
        }
      }
    }

    // Limit to 50 rows for preview to save bandwidth
    const previewData = Array.isArray(results) ? results.slice(0, 50) : results;
    
    res.json(previewData);
  } catch (error) {
    const errorMessage = error.meta?.message || error.message || 'Failed to execute query';
    console.error(`Error running query: ${errorMessage}`);
    res.status(400).json({ error: errorMessage });
  }
});

module.exports = router;
