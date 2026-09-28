import React, { useState, useEffect } from 'react';
import GridLayout, { useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import WidgetContainer from './WidgetContainer';
import KpiWidget from './KpiWidget';
import ChartWidget from './ChartWidget';
import GeoDistributionWidget from './GeoDistributionWidget';
import TableWidget from './TableWidget';

const DashboardDesigner = ({ dashboard, dashboardData, isEditMode, onLayoutChange, onSettingsClick, onDeleteClick }) => {
  const { width, containerRef } = useContainerWidth();

  const handleLayoutChange = (currentLayout) => {
    if (onLayoutChange) {
      onLayoutChange(currentLayout);
    }
  };

  const renderWidgetContent = (widget) => {
    // Expected to be provided by parent as a map: { [dataSource]: data }
    const data = (dashboardData && widget.dataSource && dashboardData[widget.dataSource]) || dashboardData || {};

    switch (widget.type) {
      case 'KPI':
        return <KpiWidget data={data.kpis ? { value: data.kpis[widget.configJson?.metric || 'totalAR'] } : null} config={widget.configJson} />;
      case 'LINE_CHART':
      case 'BAR_CHART':
      case 'DONUT_CHART':
      case 'AREA_CHART':
        const chartData = widget.type === 'DONUT_CHART' ? data.categoryData : data.timeSeriesData;
        return <ChartWidget data={chartData} config={{ ...widget.configJson, chartType: widget.type }} />;
      case 'GEOMAP':
        return <GeoDistributionWidget data={data.categoryData} />;
      case 'DATA_TABLE':
        return <TableWidget data={data.tableData} config={widget.configJson} />;
      default:
        return <div className="p-4 text-center text-gray-500">Unknown widget type: {widget.type}</div>;
    }
  };

  if (!dashboard || !dashboard.widgets) {
    return <div className="flex justify-center items-center h-64 text-gray-500">No dashboard selected or no widgets available.</div>;
  }

  return (
    <div ref={containerRef} className="relative min-h-[500px] w-full">
      <GridLayout
        className="layout"
        cols={12}
        width={width > 0 ? width : 1200}
        rowHeight={60}
        onLayoutChange={(currentLayout) => handleLayoutChange(currentLayout)}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        draggableHandle=".drag-handle"
        margin={[16, 16]}
      >
        {dashboard.widgets.map((widget, i) => {
          const defaultLayout = { x: (i * 4) % 12, y: Math.floor(i / 3) * 4, w: 4, h: 4 };
          const gridProps = Object.keys(widget.layoutJson || {}).length > 0 ? widget.layoutJson : defaultLayout;
          
          return (
            <div key={widget.id} data-grid={gridProps}>
              <WidgetContainer 
                title={widget.title}
                source={widget.dataSource}
                timestamp={new Date()}
                onSettings={isEditMode ? () => onSettingsClick(widget) : undefined}
                onDelete={isEditMode && onDeleteClick ? () => onDeleteClick(widget.id) : undefined}
              >
              {renderWidgetContent(widget)}
            </WidgetContainer>
          </div>
          );
        })}
      </GridLayout>
    </div>
  );
};

export default DashboardDesigner;
