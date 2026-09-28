import React from 'react';
import { MapPin } from 'lucide-react';
// For a real app, you'd use something like react-leaflet or similar.
// We'll mock a simple scatter/bubble visualization for distribution.

const GeoDistributionWidget = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-gray-500 flex items-center justify-center h-full">No Geo Data Available</div>;
  }

  // Mock geographic visualization using relative positioning
  return (
    <div className="relative w-full h-full min-h-[250px] bg-blue-50 rounded-lg overflow-hidden border border-blue-100 p-4">
      <div className="absolute top-2 left-2 text-blue-800 font-semibold text-sm bg-white px-2 py-1 rounded shadow-sm opacity-80">
        Regional Distribution Map
      </div>
      
      {/* Simulated map points */}
      <div className="relative w-full h-full mt-8">
        {data.map((point, index) => {
          if (!point) return null;

          // Safe extractors for dynamic data
          const name = point.name || point.nmcust || point.title || point.customer || `Point ${index + 1}`;
          const value = typeof point.value === 'number' ? point.value : (typeof point.total_balance === 'number' ? point.total_balance : (typeof point.amount === 'number' ? point.amount : 0));
          
          let top, left;
          
          // Use real coordinates if available (Rough Indonesia bounds: Lat -11 to 6, Lng 95 to 141)
          if (point.latitude !== undefined && point.longitude !== undefined && point.latitude !== null && point.longitude !== null) {
            const lat = parseFloat(point.latitude);
            const lng = parseFloat(point.longitude);
            // Map to percentage (Y inverted because top is 0)
            const mappedTop = ((6 - lat) / 17) * 100;
            const mappedLeft = ((lng - 95) / 46) * 100;
            
            // Constrain to container
            top = `${Math.max(5, Math.min(95, mappedTop))}%`;
            left = `${Math.max(5, Math.min(95, mappedLeft))}%`;
          } else {
            // Generate pseudo-random positions based on name string length just for mock display
            const safeName = String(name || '');
            top = `${(safeName.length * 7) % 80 + 10}%`;
            left = `${(value % 80) + 10}%`;
          }

          // Bubble size based on relative value (mocking scale)
          // Adjust divisor based on expected values (1 billion is a good baseline for IDR sales)
          const size = Math.max(10, Math.min(40, (value / 100000000) * 10));
          
          return (
            <div 
              key={index}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
              style={{ top, left }}
            >
              <div 
                className="bg-blue-500 rounded-full opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg"
                style={{ width: `${size}px`, height: `${size}px` }}
              >
                {size > 20 && <MapPin className="text-white w-4 h-4" />}
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute top-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                {name}: Rp {value >= 1000000000000 ? (value / 1000000000000).toFixed(1) + 'T' : value >= 1000000000 ? (value / 1000000000).toFixed(1) + 'M' : value >= 1000000 ? (value / 1000000).toFixed(1) + 'Jt' : value.toLocaleString('id-ID')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GeoDistributionWidget;
