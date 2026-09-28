import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
// Note: You can customize the theme or use ag-theme-balham-dark for better dark mode

export const ResultsGrid = ({ results }) => {
  const columnDefs = useMemo(() => {
    if (!results || !results.fields) return [];
    
    return results.fields.map(field => ({
      headerName: field,
      field: field,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 120,
      flex: 1,
      // Add custom cell renderer to stringify objects/arrays
      cellRenderer: (params) => {
        if (params.value === null) return <span className="text-gray-500 italic">null</span>;
        if (typeof params.value === 'object') return JSON.stringify(params.value);
        if (typeof params.value === 'boolean') return params.value ? 'true' : 'false';
        return params.value;
      }
    }));
  }, [results]);

  if (!results) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Run a query to see results here.
      </div>
    );
  }

  if (results.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Query executed successfully. No rows returned.
      </div>
    );
  }

  return (
    <div className="w-full h-full ag-theme-alpine-dark" style={{ '--ag-background-color': '#111827', '--ag-header-background-color': '#1f2937', '--ag-odd-row-background-color': '#111827', '--ag-row-border-color': '#374151', '--ag-border-color': '#374151' }}>
      <AgGridReact
        rowData={results.rows}
        columnDefs={columnDefs}
        animateRows={true}
        rowSelection="multiple"
        suppressCellFocus={true}
        enableCellTextSelection={true}
      />
    </div>
  );
};
