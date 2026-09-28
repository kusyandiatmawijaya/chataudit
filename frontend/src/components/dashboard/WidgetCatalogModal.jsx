import React from 'react';
import { X, BarChart2, PieChart, Activity, Table2, Map } from 'lucide-react';

const WIDGET_TEMPLATES = [
  {
    id: 'tpl_kpi',
    title: 'Custom KPI',
    type: 'KPI',
    dataSource: 'SALES_COLLECTION_SUMMARY',
    configJson: { metric: 'totalAR', format: 'currency' },
    layoutJson: { w: 3, h: 2 },
    icon: Activity,
    description: 'Displays a single metric value with trend comparison.'
  },
  {
    id: 'tpl_line',
    title: 'Line Chart',
    type: 'LINE_CHART',
    dataSource: 'SALES_COLLECTION_SUMMARY',
    configJson: { xAxisKey: 'month', yAxisKeys: ['sales'] },
    layoutJson: { w: 6, h: 4 },
    icon: BarChart2,
    description: 'Line chart to visualize trends over time.'
  },
  {
    id: 'tpl_bar',
    title: 'Bar Chart',
    type: 'BAR_CHART',
    dataSource: 'SALES_COLLECTION_SUMMARY',
    configJson: { xAxisKey: 'month', yAxisKeys: ['sales'] },
    layoutJson: { w: 6, h: 4 },
    icon: BarChart2,
    description: 'Bar chart for categorical comparison.'
  },
  {
    id: 'tpl_donut',
    title: 'Donut Chart',
    type: 'DONUT_CHART',
    dataSource: 'SALES_COLLECTION_SUMMARY',
    configJson: { xAxisKey: 'name', yAxisKeys: ['value'] },
    layoutJson: { w: 4, h: 4 },
    icon: PieChart,
    description: 'Donut chart showing composition or share.'
  },
  {
    id: 'tpl_table',
    title: 'Data Table',
    type: 'DATA_TABLE',
    dataSource: 'SALES_COLLECTION_SUMMARY',
    configJson: {},
    layoutJson: { w: 8, h: 6 },
    icon: Table2,
    description: 'Detailed grid displaying row-level data.'
  },
  {
    id: 'tpl_geo',
    title: 'Geo Map',
    type: 'GEOMAP',
    dataSource: 'SALES_COLLECTION_SUMMARY',
    configJson: {},
    layoutJson: { w: 6, h: 5 },
    icon: Map,
    description: 'Geographic distribution visualization.'
  }
];

const WidgetCatalogModal = ({ isOpen, onClose, onAddWidget }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Add New Widget</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto bg-gray-50/30 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {WIDGET_TEMPLATES.map((template) => (
              <div 
                key={template.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col"
                onClick={() => onAddWidget(template)}
              >
                <div className="flex items-start space-x-4 mb-2">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <template.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{template.title}</h3>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{template.type}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2 flex-1">{template.description}</p>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs text-gray-400">Default Size: {template.layoutJson.w}x{template.layoutJson.h}</span>
                  <button className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
                    Add to Dashboard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetCatalogModal;
