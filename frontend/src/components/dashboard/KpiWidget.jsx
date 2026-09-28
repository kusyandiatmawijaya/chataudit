import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const KpiWidget = ({ data, config }) => {
  if (!data || !config) return <div className="text-gray-500 flex items-center justify-center h-full">No Data</div>;

  const { value, previousValue, label, targetValue } = data;
  const format = config.format || data.format || 'currency';
  const prefix = config.prefix !== undefined ? config.prefix : (format === 'currency' ? 'Rp ' : '');
  const suffix = config.suffix || '';

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000000000) return (num / 1000000000000).toFixed(2) + 'T';
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'M';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'Jt';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'Rb';
    return num.toLocaleString('id-ID');
  };

  const calculateTrend = () => {
    if (!previousValue || previousValue === 0) return { type: 'neutral', value: 0 };
    const diff = value - previousValue;
    const percentage = (diff / previousValue) * 100;
    
    if (percentage > 0) return { type: 'positive', value: percentage };
    if (percentage < 0) return { type: 'negative', value: Math.abs(percentage) };
    return { type: 'neutral', value: 0 };
  };

  const trend = calculateTrend();
  
  // Progress bar logic if target is defined
  const progress = targetValue && targetValue > 0 ? Math.min((value / targetValue) * 100, 100) : null;

  return (
    <div className="flex flex-col justify-center h-full">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label || config.label}</p>
          <div className="flex items-baseline space-x-1 mt-1">
            {prefix && <span className="text-xl text-gray-400 font-semibold">{prefix}</span>}
            <h4 className="text-3xl font-bold text-gray-800 tracking-tight">{formatNumber(value)}</h4>
            {suffix && <span className="text-xl text-gray-400 font-semibold">{suffix}</span>}
          </div>
        </div>
        
        {/* Trend Indicator */}
        <div className={`flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
          trend.type === 'positive' ? 'bg-green-100 text-green-700' :
          trend.type === 'negative' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {trend.type === 'positive' && <TrendingUp className="w-3 h-3 mr-1" />}
          {trend.type === 'negative' && <TrendingDown className="w-3 h-3 mr-1" />}
          {trend.type === 'neutral' && <Minus className="w-3 h-3 mr-1" />}
          {trend.value.toFixed(1)}%
        </div>
      </div>
      
      {/* Target Progress Bar */}
      {progress !== null && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress to Target</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KpiWidget;
