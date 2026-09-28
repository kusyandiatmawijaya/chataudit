const dbExplorerService = require('../services/dbExplorer.service');

const getSchemas = async (req, res) => {
  try {
    const schemas = await dbExplorerService.getSchemas();
    res.json(schemas);
  } catch (error) {
    console.error('Error fetching schemas:', error);
    res.status(500).json({ error: 'Internal Server Error fetching schemas' });
  }
};

const getTableStructure = async (req, res) => {
  try {
    const { tableName } = req.params;
    const structure = await dbExplorerService.getTableStructure(tableName);
    res.json(structure);
  } catch (error) {
    console.error('Error fetching table structure:', error);
    res.status(500).json({ error: 'Internal Server Error fetching table structure' });
  }
};

const getIndexes = async (req, res) => {
  try {
    const indexes = await dbExplorerService.getIndexes();
    res.json(indexes);
  } catch (error) {
    console.error('Error fetching indexes:', error);
    res.status(500).json({ error: 'Internal Server Error fetching indexes' });
  }
};

const executeQuery = async (req, res) => {
  try {
    const { query, params } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    const result = await dbExplorerService.executeQuery(query, params);
    
    // Always return 200, even if there's a SQL error, so the frontend can display it gracefully
    res.json(result);
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({ error: 'Internal Server Error executing query' });
  }
};

module.exports = {
  getSchemas,
  getTableStructure,
  getIndexes,
  executeQuery,
};
