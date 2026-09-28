const xlsx = require('xlsx');
const dbExplorerService = require('../services/dbExplorer.service');

const exportQuery = async (req, res) => {
  try {
    const { query, format } = req.body;

    if (!query || !format) {
      return res.status(400).json({ error: 'Query and format are required' });
    }

    const result = await dbExplorerService.executeQuery(query);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const data = result.rows;

    if (format === 'json') {
      return res.json(data);
    } 
    
    if (format === 'txt') {
      if (data.length === 0) {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename="export.txt"');
        return res.send('');
      }
      
      const keys = Object.keys(data[0]);
      let csvContent = keys.join('\t') + '\n';
      
      data.forEach(row => {
        csvContent += keys.map(k => {
          let val = row[k];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val).replace(/\t/g, ' '); // avoid breaking tabs
        }).join('\t') + '\n';
      });

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="export.txt"');
      return res.send(csvContent);
    } 
    
    if (format === 'excel') {
      const worksheet = xlsx.utils.json_to_sheet(data);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Export");
      
      const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="export.xlsx"');
      return res.send(buffer);
    }

    return res.status(400).json({ error: 'Unsupported format. Use json, txt, or excel' });

  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ error: 'Internal Server Error during export' });
  }
};

const exportSchema = async (req, res) => {
  try {
    const ddl = await dbExplorerService.getExportSchema();
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="schema.sql"');
    return res.send(ddl);
  } catch (error) {
    console.error('Export Schema Error:', error);
    res.status(500).json({ error: 'Internal Server Error during schema export' });
  }
};

module.exports = {
  exportQuery,
  exportSchema,
};
