import React, { useState, useEffect } from 'react';
import { Filter, Calendar } from 'lucide-react';
import { API_URL } from '../../config';

const DashboardFilterBar = ({ filters, setFilters }) => {
  const [dynamicOptions, setDynamicOptions] = useState({
    years: [],
    months: [],
    divisions: [],
    salesmen: []
  });

  const [enabled, setEnabled] = useState({
    year: false,
    dateRange: false,
    division: false,
    salesman: false
  });

  useEffect(() => {
    // If the parent passed filters that are not 'all' or 'this_month' (which is the default in some older code),
    // we could optionally set enabled to true. For simplicity, we initialize them based on if they have valid selected values.
    // However, keeping them false initially until user interaction is what the user asked for (explicit enable).
    const fetchFilters = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/dashboard/filters`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setDynamicOptions(data);
        }
      } catch (error) {
        console.error('Error fetching dashboard filters:', error);
      }
    };
    fetchFilters();
  }, []);

  const handleDateChange = (e) => {
    setFilters(prev => ({ ...prev, dateRange: e.target.value }));
  };

  const handleDimensionChange = (e, field) => {
    setFilters(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleCheckboxChange = (field, isChecked) => {
    setEnabled(prev => ({ ...prev, [field]: isChecked }));
    if (!isChecked) {
      setFilters(prev => ({ ...prev, [field]: 'all' }));
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      <div className="flex items-center space-x-2">
        <Filter className="w-5 h-5 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-800">Global Filters</h2>
      </div>

      <div className="flex items-center space-x-4">
        {/* Year Filter */}
        <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 rounded-md px-3 py-1.5">
          <input 
            type="checkbox" 
            checked={enabled.year} 
            onChange={(e) => handleCheckboxChange('year', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            title="Enable Year Filter"
          />
          <Calendar className="w-4 h-4 text-gray-500" />
          <select 
            className="bg-transparent border-none text-sm focus:ring-0 text-gray-700 outline-none disabled:opacity-50"
            value={filters.year || 'all'}
            onChange={(e) => handleDimensionChange(e, 'year')}
            disabled={!enabled.year}
          >
            <option value="all">All Years</option>
            {dynamicOptions.years?.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </select>
        </div>

        {/* Date Range Picker (Dynamic) */}
        <div className="flex items-center space-x-2 bg-gray-50 border border-gray-300 rounded-md px-3 py-1.5">
          <input 
            type="checkbox" 
            checked={enabled.dateRange} 
            onChange={(e) => handleCheckboxChange('dateRange', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            title="Enable Month Filter"
          />
          <Calendar className="w-4 h-4 text-gray-500" />
          <select 
            className="bg-transparent border-none text-sm focus:ring-0 text-gray-700 outline-none disabled:opacity-50"
            value={filters.dateRange || 'all'}
            onChange={handleDateChange}
            disabled={!enabled.dateRange}
          >
            <option value="all">All Months</option>
            {dynamicOptions.months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Division/Geography Filter */}
        <div className="flex items-center space-x-2 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
          <input 
            type="checkbox" 
            checked={enabled.division} 
            onChange={(e) => handleCheckboxChange('division', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            title="Enable Division Filter"
          />
          <select 
            className="bg-transparent border-none text-sm focus:ring-0 text-gray-700 outline-none disabled:opacity-50 w-full"
            value={filters.division || 'all'}
            onChange={(e) => handleDimensionChange(e, 'division')}
            disabled={!enabled.division}
          >
            <option value="all">All Divisions</option>
            {dynamicOptions.divisions.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        
        {/* Salesman Filter */}
        <div className="flex items-center space-x-2 bg-white border border-gray-300 rounded-md px-3 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
          <input 
            type="checkbox" 
            checked={enabled.salesman} 
            onChange={(e) => handleCheckboxChange('salesman', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            title="Enable Salesman Filter"
          />
          <select 
            className="bg-transparent border-none text-sm focus:ring-0 text-gray-700 outline-none disabled:opacity-50 w-full"
            value={filters.salesman || 'all'}
            onChange={(e) => handleDimensionChange(e, 'salesman')}
            disabled={!enabled.salesman}
          >
            <option value="all">All Salesmen</option>
            {dynamicOptions.salesmen.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default DashboardFilterBar;

