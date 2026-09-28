import React from 'react';

const TableWidget = ({ data, config }) => {
  if (!data || !Array.isArray(data) || data.length === 0) return <div className="text-gray-500 flex items-center justify-center h-full">No Data Available</div>;

  let columns = config?.columns;
  if (!columns || columns.length === 0) {
    // Generate columns dynamically from the first row of data
    if (data && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
      columns = Object.keys(data[0]).map(key => {
        const val = data[0][key];
        return {
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
          type: typeof val === 'number' ? 'number' : 'text'
        };
      });
    } else {
      columns = [];
    }
  }

  const formatCell = (value, type) => {
    if (value === null || value === undefined) return '-';
    if (type === 'currency' && !isNaN(value)) return `Rp ${Number(value).toLocaleString()}`;
    if (type === 'date' && value) return new Date(value).toLocaleDateString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getCellClassName = (value, key) => {
    if (key === 'balance' && value > 0) return 'text-red-600 font-medium';
    if (key === 'paid' && value > 0) return 'text-green-600';
    return 'text-gray-700';
  };

  return (
    <div className="w-full h-full overflow-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
          <tr>
            {columns.map((col, idx) => (
              <th 
                key={idx}
                scope="col" 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-blue-50 transition-colors">
              {columns.map((col, colIndex) => {
                const cellValue = row ? row[col.key] : null;
                return (
                  <td 
                    key={colIndex} 
                    className={`px-4 py-3 whitespace-nowrap text-sm ${getCellClassName(cellValue, col.key)}`}
                  >
                    {formatCell(cellValue, col.type)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableWidget;
