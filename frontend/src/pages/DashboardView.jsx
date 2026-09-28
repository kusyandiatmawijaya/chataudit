import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Plus, Save, Layout } from 'lucide-react';
import DashboardDesigner from '../components/dashboard/DashboardDesigner';
import DashboardFilterBar from '../components/dashboard/DashboardFilterBar';
import WidgetCatalogModal from '../components/dashboard/WidgetCatalogModal';
import WidgetSettingsModal from '../components/dashboard/WidgetSettingsModal';
import { API_URL } from '../config';

const DashboardView = () => {
  const [dashboard, setDashboard] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [filters, setFilters] = useState({ year: 'all', dateRange: 'all', division: 'all', salesman: 'all' });
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (dashboard) {
      fetchDashboardData();
    }
  }, [dashboard, filters]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // For this implementation, we fetch all and pick the default or first one
      const response = await axios.get(`${API_URL}/api/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const dashboards = response.data;
      if (dashboards.length > 0) {
        // Find default or use first
        let activeDashboard = dashboards.find(d => d.isDefault) || dashboards[0];
        
        // Fetch full dashboard with widgets
        const dashDetailResponse = await axios.get(`${API_URL}/api/dashboard/${activeDashboard.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // If it has no widgets, maybe provide some dummy ones for demonstration
        let finalDashboard = dashDetailResponse.data;
        if (!finalDashboard.widgets || finalDashboard.widgets.length === 0) {
          finalDashboard = {
            ...finalDashboard,
            widgets: [
              { id: 'w1', title: 'Total AR', type: 'KPI', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: { metric: 'totalAR', format: 'currency' }, layoutJson: { x: 0, y: 0, w: 3, h: 2 } },
              { id: 'w2', title: 'Total Paid', type: 'KPI', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: { metric: 'totalPaid', format: 'currency' }, layoutJson: { x: 3, y: 0, w: 3, h: 2 } },
              { id: 'w3', title: 'Collection Rate', type: 'KPI', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: { metric: 'collectionRate', format: 'percentage', suffix: '%' }, layoutJson: { x: 6, y: 0, w: 3, h: 2 } },
              { id: 'w4', title: 'Sales vs Collection Trend', type: 'LINE_CHART', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: { xAxisKey: 'month', yAxisKeys: ['sales', 'collection'] }, layoutJson: { x: 0, y: 2, w: 8, h: 5 } },
              { id: 'w5', title: 'Sales by Channel', type: 'DONUT_CHART', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: { xAxisKey: 'name', yAxisKeys: ['value'] }, layoutJson: { x: 8, y: 2, w: 4, h: 5 } },
              { id: 'w6', title: 'Outstanding AR List', type: 'DATA_TABLE', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: {}, layoutJson: { x: 0, y: 7, w: 12, h: 6 } }
            ]
          };
          
          // Optionally save these default widgets to backend immediately
          await axios.put(`${API_URL}/api/dashboard/${finalDashboard.id}/widgets`, { widgets: finalDashboard.widgets }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        
        setDashboard(finalDashboard);
      } else {
        // Create a default dashboard if none exist
        const createRes = await axios.post(`${API_URL}/api/dashboard`, {
          name: 'Main Dashboard',
          description: 'Default executive dashboard',
          isDefault: true
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        const newDashboard = createRes.data;
        
        // Add default widgets to the newly created dashboard
        const defaultWidgets = [
          { id: 'w1', title: 'Total AR', type: 'KPI', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: { metric: 'totalAR', format: 'currency' }, layoutJson: { x: 0, y: 0, w: 3, h: 2 } },
          { id: 'w2', title: 'Total Paid', type: 'KPI', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: { metric: 'totalPaid', format: 'currency' }, layoutJson: { x: 3, y: 0, w: 3, h: 2 } },
          { id: 'w3', title: 'Collection Rate', type: 'KPI', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: { metric: 'collectionRate', format: 'percentage', suffix: '%' }, layoutJson: { x: 6, y: 0, w: 3, h: 2 } },
          { id: 'w4', title: 'Sales vs Collection Trend', type: 'LINE_CHART', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: { xAxisKey: 'month', yAxisKeys: ['sales', 'collection'] }, layoutJson: { x: 0, y: 2, w: 8, h: 5 } },
          { id: 'w5', title: 'Sales by Channel', type: 'DONUT_CHART', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: { xAxisKey: 'name', yAxisKeys: ['value'] }, layoutJson: { x: 8, y: 2, w: 4, h: 5 } },
          { id: 'w6', title: 'Outstanding AR List', type: 'DATA_TABLE', dataSource: 'SALES_COLLECTION_SUMMARY', configJson: {}, layoutJson: { x: 0, y: 7, w: 12, h: 6 } }
        ];

        await axios.put(`${API_URL}/api/dashboard/${newDashboard.id}/widgets`, { widgets: defaultWidgets }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setDashboard({ ...newDashboard, widgets: defaultWidgets });
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    if (!dashboard || !dashboard.widgets) return;
    
    try {
      const token = localStorage.getItem('token');
      
      // Get unique data sources
      const uniqueDataSources = [...new Set(dashboard.widgets.map(w => w.dataSource).filter(Boolean))];
      
      if (uniqueDataSources.length === 0) {
        uniqueDataSources.push('SALES_COLLECTION_SUMMARY'); // Fallback
      }

      // Fetch data for all data sources in parallel
      const dataPromises = uniqueDataSources.map(ds => 
        axios.post(`${API_URL}/api/dashboard/data`, {
          dataSource: ds,
          filters
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => ({ source: ds, data: res.data }))
        .catch(err => ({ source: ds, data: { error: err.message } }))
      );
      
      const results = await Promise.all(dataPromises);
      
      // Create a map of dataSource -> data
      const dataMap = results.reduce((acc, curr) => {
        acc[curr.source] = curr.data;
        return acc;
      }, {});

      setDashboardData(dataMap);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleLayoutChange = (newLayout) => {
    if (dashboard && isEditMode) {
      // Create a map for quick lookup
      const layoutMap = newLayout.reduce((acc, l) => {
        acc[l.i] = { x: l.x, y: l.y, w: l.w, h: l.h };
        return acc;
      }, {});

      // Update local state
      const updatedWidgets = dashboard.widgets.map(w => ({
        ...w,
        layoutJson: layoutMap[w.id] || w.layoutJson
      }));

      setDashboard({ ...dashboard, widgets: updatedWidgets });
    }
  };

  const saveLayout = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/dashboard/${dashboard.id}/widgets`, {
        widgets: dashboard.widgets
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsEditMode(false);
      // Optional: show toast notification
    } catch (error) {
      console.error('Error saving dashboard layout:', error);
    }
  };

  const handleAddWidget = (template) => {
    if (!dashboard) return;

    // Determine Y position by finding the maximum Y + H of existing widgets
    let maxY = 0;
    dashboard.widgets.forEach(w => {
      const bottom = (w.layoutJson?.y || 0) + (w.layoutJson?.h || 0);
      if (bottom > maxY) maxY = bottom;
    });

    const newWidget = {
      id: `temp_${Date.now()}`,
      title: template.title,
      type: template.type,
      dataSource: template.dataSource,
      configJson: template.configJson,
      layoutJson: { ...template.layoutJson, x: 0, y: maxY }
    };

    setDashboard({
      ...dashboard,
      widgets: [...dashboard.widgets, newWidget]
    });
    
    setIsCatalogOpen(false);
  };

  const handleSaveWidgetSettings = (updatedWidget) => {
    if (!dashboard) return;
    
    setDashboard({
      ...dashboard,
      widgets: dashboard.widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w)
    });
    
    setEditingWidget(null);
  };

  const handleDeleteWidget = (widgetId) => {
    if (!dashboard) return;
    
    if (window.confirm('Are you sure you want to delete this widget?')) {
      setDashboard({
        ...dashboard,
        widgets: dashboard.widgets.filter(w => w.id !== widgetId)
      });
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading Dashboard...</div>;
  }

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-gray-50/50 min-h-screen">
      {/* Dashboard Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
            <Layout className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{dashboard?.name || 'Dashboard Analysis'}</h1>
            <p className="text-sm text-gray-500">{dashboard?.description || 'Real-time performance metrics'}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {isEditMode ? (
            <>
              <button 
                onClick={() => setIsEditMode(false)} 
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsCatalogOpen(true)}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md shadow-sm transition-colors flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Widget
              </button>
              <button 
                onClick={saveLayout}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Layout
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditMode(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md shadow-sm transition-colors flex items-center"
            >
              <Settings className="w-4 h-4 mr-2" />
              Edit Dashboard
            </button>
          )}
        </div>
      </div>

      <DashboardFilterBar filters={filters} setFilters={setFilters} />

      <div className="flex-1 p-6 overflow-x-hidden">
        {dashboard && (
          <DashboardDesigner 
            dashboard={dashboard} 
            dashboardData={dashboardData} 
            isEditMode={isEditMode}
            onLayoutChange={handleLayoutChange}
            onSettingsClick={setEditingWidget}
            onDeleteClick={handleDeleteWidget}
          />
        )}
      </div>

      <WidgetCatalogModal 
        isOpen={isCatalogOpen} 
        onClose={() => setIsCatalogOpen(false)} 
        onAddWidget={handleAddWidget} 
      />

      <WidgetSettingsModal
        isOpen={!!editingWidget}
        widget={editingWidget}
        onClose={() => setEditingWidget(null)}
        onSave={handleSaveWidgetSettings}
      />
    </div>
  );
};

export default DashboardView;
