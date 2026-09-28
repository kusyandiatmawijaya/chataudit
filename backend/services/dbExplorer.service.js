const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

/**
 * Executes a raw query safely.
 */
const executeQuery = async (query, params = []) => {
  try {
    const result = await pool.query(query, params);
    return {
      success: true,
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => f.name),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Gets all schemas, tables, and views.
 */
const getSchemas = async () => {
  const query = `
    SELECT 
      table_schema AS schema, 
      table_name AS name, 
      table_type AS type
    FROM information_schema.tables
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_type, table_name;
  `;
  const result = await pool.query(query);
  
  const schemas = {};
  for (const row of result.rows) {
    if (!schemas[row.schema]) {
      schemas[row.schema] = { tables: [], views: [] };
    }
    if (row.type === 'VIEW') {
      schemas[row.schema].views.push(row.name);
    } else {
      schemas[row.schema].tables.push(row.name);
    }
  }
  return schemas;
};

/**
 * Gets the column structure for a specific table.
 */
const getTableStructure = async (tableName) => {
  const query = `
    SELECT 
      c.column_name, 
      c.data_type, 
      c.character_maximum_length,
      c.is_nullable,
      c.column_default,
      (
        SELECT COUNT(*) > 0 
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc 
          ON kcu.constraint_name = tc.constraint_name
        WHERE kcu.table_name = c.table_name 
          AND kcu.column_name = c.column_name
          AND tc.constraint_type = 'PRIMARY KEY'
      ) as is_primary_key
    FROM information_schema.columns c
    WHERE c.table_name = $1
    ORDER BY c.ordinal_position;
  `;
  const result = await pool.query(query, [tableName]);
  return result.rows;
};

/**
 * Gets all indexes.
 */
const getIndexes = async () => {
  const query = `
    SELECT 
      schemaname AS schema, 
      tablename AS table, 
      indexname AS index_name, 
      indexdef AS index_definition
    FROM pg_indexes
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname, tablename, indexname;
  `;
  const result = await pool.query(query);
  return result.rows;
};

/**
 * Generates DDL for the database (basic schema export).
 */
const getExportSchema = async () => {
  const query = `
    SELECT 
      table_schema, 
      table_name, 
      column_name, 
      data_type, 
      character_maximum_length, 
      is_nullable, 
      column_default
    FROM information_schema.columns
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name, ordinal_position;
  `;
  
  const result = await pool.query(query);
  
  let ddl = '-- Database Schema Export\n\n';
  let currentTable = null;
  
  for (const row of result.rows) {
    const tableName = `"${row.table_schema}"."${row.table_name}"`;
    
    if (tableName !== currentTable) {
      if (currentTable !== null) {
        ddl += ');\n\n';
      }
      ddl += `CREATE TABLE ${tableName} (\n`;
      currentTable = tableName;
    } else {
      ddl += ',\n';
    }
    
    let colDef = `  "${row.column_name}" ${row.data_type}`;
    if (row.character_maximum_length) {
      colDef += `(${row.character_maximum_length})`;
    }
    if (row.is_nullable === 'NO') {
      colDef += ' NOT NULL';
    }
    if (row.column_default) {
      colDef += ` DEFAULT ${row.column_default}`;
    }
    ddl += colDef;
  }
  
  if (currentTable !== null) {
    ddl += '\n);\n';
  }
  
  return ddl;
};


module.exports = {
  executeQuery,
  getSchemas,
  getTableStructure,
  getIndexes,
  getExportSchema,
};
