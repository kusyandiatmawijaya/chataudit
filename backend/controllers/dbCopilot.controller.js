const { openai, getModelForRole } = require('../utils/Orchestrator');
const dbExplorerService = require('../services/dbExplorer.service');

const generateSql = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Fetch the DDL schema to provide context to the AI
    const ddlSchema = await dbExplorerService.getExportSchema();
    const model = await getModelForRole('ANALYTICAL');

    const systemMessage = `
You are an expert PostgreSQL Database Architect and SQL Developer AI Copilot.
Your task is to generate a secure, valid PostgreSQL SQL query based on the user's natural language instruction.
You are given the current database schema as context.
Rules:
1. Return ONLY the raw SQL query. Do not include markdown code blocks like \`\`\`sql ... \`\`\`.
2. Do not include any explanations outside the SQL query.
3. If you need to explain, use inline SQL comments (--) within the query itself.
4. Always handle JOINs correctly based on typical naming conventions (e.g., customer_code, salesman_code).
5. Default to a reasonable LIMIT (e.g., LIMIT 100) if not specified, unless it's an aggregation.
6. The query must be valid PostgreSQL dialect.
7. Be schema-aware. Only use tables and columns that exist in the schema below.

Database Schema:
${ddlSchema}
`;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, // Low temperature for deterministic code generation
    });

    let generatedSql = response.choices[0].message.content.trim();
    
    // Clean up if the model accidentally included markdown formatting
    if (generatedSql.startsWith('```sql')) {
      generatedSql = generatedSql.substring(6);
    }
    if (generatedSql.startsWith('```')) {
      generatedSql = generatedSql.substring(3);
    }
    if (generatedSql.endsWith('```')) {
      generatedSql = generatedSql.substring(0, generatedSql.length - 3);
    }
    generatedSql = generatedSql.trim();

    res.json({ sql: generatedSql });
  } catch (error) {
    console.error('Error generating SQL via AI:', error);
    res.status(500).json({ error: 'Internal Server Error generating SQL via AI' });
  }
};

const explainSql = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const ddlSchema = await dbExplorerService.getExportSchema();
    const model = await getModelForRole('ANALYTICAL');

    const systemMessage = `
You are an expert Data Analyst and PostgreSQL Database Expert AI.
Your task is to explain the provided SQL query in clear, simple terms (in Indonesian).
Map human terms to actual database columns (e.g., "Omzet" to orders_monthly.total_omzet).
Explain the purpose of the JOINs, WHERE clauses, and any aggregations.
Provide the response in clean Markdown format.

Database Schema Context:
${ddlSchema}
`;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: `Please explain this SQL query:\n\n${query}` }
      ],
      temperature: 0.3,
    });

    const explanation = response.choices[0].message.content.trim();

    res.json({ explanation });
  } catch (error) {
    console.error('Error explaining SQL via AI:', error);
    res.status(500).json({ error: 'Internal Server Error explaining SQL via AI' });
  }
};

module.exports = {
  generateSql,
  explainSql,
};
