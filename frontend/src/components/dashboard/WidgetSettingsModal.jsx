import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';

const WidgetSettingsModal = ({ isOpen, widget, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    dataSource: '',
    metric: '',
    xAxisKey: '',
    yAxisKeys: ''
  });

  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDataSources = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/data-sources`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDataSources(response.data);
      } catch (error) {
        console.error('Error fetching data sources:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDataSources();
  }, []);

  useEffect(() => {
    if (widget) {
      setFormData({
        title: widget.title || '',
        dataSource: widget.dataSource || 'SALES_COLLECTION_SUMMARY',
        metric: widget.configJson?.metric || '',
        xAxisKey: widget.configJson?.xAxisKey || '',
        yAxisKeys: widget.configJson?.yAxisKeys ? widget.configJson.yAxisKeys.join(', ') : ''
      });
    }
  }, [widget]);

  if (!isOpen || !widget) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    // Reconstruct configJson based on widget type
    let newConfig = { ...widget.configJson };
    
    if (widget.type === 'KPI') {
      newConfig.metric = formData.metric;
    } else if (['LINE_CHART', 'BAR_CHART', 'AREA_CHART'].includes(widget.type)) {
      newConfig.xAxisKey = formData.xAxisKey;
      newConfig.yAxisKeys = formData.yAxisKeys.split(',').map(s => s.trim()).filter(Boolean);
    } else if (widget.type === 'DONUT_CHART') {
      newConfig.xAxisKey = formData.xAxisKey;
      newConfig.yAxisKeys = formData.yAxisKeys.split(',').map(s => s.trim()).filter(Boolean);
    }

    const updatedWidget = {
      ...widget,
      title: formData.title,
      dataSource: formData.dataSource,
      configJson: newConfig
    };

    onSave(updatedWidget);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Widget Settings</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Widget Title</label>
            <input 
              type="text" 
              name="title"
              value={formData.title} 
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
            <select 
              name="dataSource"
              value={formData.dataSource} 
              onChange={handleChange}
              disabled={loading}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="SALES_COLLECTION_SUMMARY">Sales & Collection Summary (Mock)</option>
              {dataSources.filter(ds => {
                try {
                  const types = JSON.parse(ds.widgetTypes || '[]');
                  return types.length === 0 || types.includes(widget.type);
                } catch(e) {
                  return true;
                }
              }).map(ds => (
                <option key={ds.id} value={ds.name}>{ds.name}</option>
              ))}
            </select>
            {loading && <p className="text-xs text-blue-500 mt-1 flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-1"/> Loading data sources...</p>}
          </div>

          {widget.type === 'KPI' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metric Key</label>
              <input 
                type="text" 
                name="metric"
                value={formData.metric} 
                onChange={handleChange}
                placeholder="e.g. totalAR"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">The JSON key returned by the data source endpoint.</p>
            </div>
          )}

          {['LINE_CHART', 'BAR_CHART', 'AREA_CHART', 'DONUT_CHART'].includes(widget.type) && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">X-Axis Key (Dimension)</label>
                <input 
                  type="text" 
                  name="xAxisKey"
                  value={formData.xAxisKey} 
                  onChange={handleChange}
                  placeholder="e.g. month or category"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Y-Axis Keys (Measures)</label>
                <input 
                  type="text" 
                  name="yAxisKeys"
                  value={formData.yAxisKeys} 
                  onChange={handleChange}
                  placeholder="e.g. sales, collection"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple keys with commas.</p>
              </div>
            </>
          )}

        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default WidgetSettingsModal;
