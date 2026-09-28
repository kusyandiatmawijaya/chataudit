import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Search } from 'lucide-react';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getDayColor = (day) => {
  switch(day?.toUpperCase()) {
    case 'SENIN': return '#3b82f6'; // blue-500
    case 'SELASA': return '#10b981'; // emerald-500
    case 'RABU': return '#f59e0b'; // amber-500
    case 'KAMIS': return '#8b5cf6'; // purple-500
    case 'JUMAT': return '#ec4899'; // pink-500
    case 'SABTU': return '#ef4444'; // red-500
    case 'MINGGU': return '#06b6d4'; // cyan-500
    default: return '#94a3b8'; // slate-400
  }
};

const getDynamicIcon = (day, frequency) => {
  const color = getDayColor(day);
  const isGanjil = frequency?.toUpperCase() === 'GANJIL';
  const isGenap = frequency?.toUpperCase() === 'GENAP';
  
  let html = '';
  if (isGanjil) {
    // Hollow circle
    html = `<div style="background-color: white; width: 24px; height: 24px; border-radius: 50%; border: 4px solid ${color}; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`;
  } else if (isGenap) {
    // Square
    html = `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 4px; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`;
  } else {
    // Default (Weekly) Solid circle
    html = `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`;
  }

  return new L.DivIcon({
    className: 'custom-div-icon',
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function SalesCoverageMap() {
  const [salesmen, setSalesmen] = useState([]);
  const [coverages, setCoverages] = useState([]);
  
  // Filters
  const [salesmanCode, setSalesmanCode] = useState('Semua');
  const [visitDay, setVisitDay] = useState('Semua Hari');
  const [visitFrequency, setVisitFrequency] = useState('Semua Frekuensi');
  const [storeStatus, setStoreStatus] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [center, setCenter] = useState([-6.200000, 106.816666]); // Default Jakarta

  useEffect(() => {
    fetchSalesmen();
  }, []);

  useEffect(() => {
    fetchCoverages();
  }, [salesmanCode, visitDay, visitFrequency, storeStatus]);

  const fetchSalesmen = async () => {
    try {
      const res = await axios.get('/api/sales-coverages/salesmen');
      setSalesmen(res.data);
    } catch (err) {
      console.error('Failed to fetch salesmen:', err);
    }
  };

  const fetchCoverages = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/sales-coverages', {
        params: {
          salesman_code: salesmanCode,
          visit_day: visitDay,
          visit_frequency: visitFrequency,
          store_operational_status: storeStatus
        }
      });
      setCoverages(res.data);
      
      const valid = res.data.filter(c => c.latitude && c.longitude);
      if (valid.length > 0) {
        setCenter([valid[0].latitude, valid[0].longitude]);
      }
    } catch (err) {
      console.error('Failed to fetch coverages:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCoverages = coverages.filter(c => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return (
      (c.customer_name && c.customer_name.toLowerCase().includes(lowerQuery)) ||
      (c.customer_code && c.customer_code.toLowerCase().includes(lowerQuery)) ||
      (c.full_store_address && c.full_store_address.toLowerCase().includes(lowerQuery))
    );
  });

  // Legacy getStatusIcon not used anymore for map markers
  const getStatusIcon = (status) => {
    return getDynamicIcon('unknown', 'unknown');
  };

  const getStatusColor = (status) => {
    if (status === 'ACTIVE') return 'text-emerald-700 bg-emerald-100';
    if (status === 'NEW' || status === 'REGISTER') return 'text-amber-700 bg-amber-100';
    return 'text-slate-700 bg-slate-100';
  };

  const validPoints = filteredCoverages.filter(c => c.latitude && c.longitude);

  return (
    <div className="flex w-full h-full bg-white relative">
      {/* Left Sidebar */}
      <div className="w-[400px] flex flex-col h-full border-r border-slate-200 z-10 bg-white relative shadow-lg shrink-0">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 flex items-center mb-1">
            <MapPin className="w-5 h-5 mr-2 text-emerald-600" />
            Peta Rute & Kunjungan
          </h2>
          <p className="text-xs text-slate-500 mb-4">Monitoring titik sebaran toko, jadwal rute & live position</p>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text"
              placeholder="Cari nama toko, kode, atau alamat..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">Pilih Salesman</label>
              <select 
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={salesmanCode}
                onChange={(e) => setSalesmanCode(e.target.value)}
              >
                <option value="Semua">Semua Salesman</option>
                {salesmen.map(s => (
                  <option key={s.salesman_code} value={s.salesman_code}>
                    {s.salesman_name} - {s.salesman_code}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">Hari Kunjungan</label>
                <select 
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={visitDay}
                  onChange={(e) => setVisitDay(e.target.value)}
                >
                  <option value="Semua Hari">Semua Hari</option>
                  <option value="SENIN">Senin</option>
                  <option value="SELASA">Selasa</option>
                  <option value="RABU">Rabu</option>
                  <option value="KAMIS">Kamis</option>
                  <option value="JUMAT">Jumat</option>
                  <option value="SABTU">Sabtu</option>
                  <option value="MINGGU">Minggu</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">Frekuensi</label>
                <select 
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={visitFrequency}
                  onChange={(e) => setVisitFrequency(e.target.value)}
                >
                  <option value="Semua Frekuensi">Semua Frekuensi</option>
                  <option value="GANJIL">Ganjil</option>
                  <option value="GENAP">Genap</option>
                  <option value="F1">F1</option>
                  <option value="F2">F2</option>
                  <option value="F4">F4</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">Status Gerai</label>
              <div className="flex gap-2">
                {['Semua', 'ACTIVE', 'REGISTER'].map(status => (
                  <button
                    key={status}
                    onClick={() => setStoreStatus(status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                      storeStatus === status 
                        ? 'bg-slate-800 text-white border-slate-800' 
                        : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    {status === 'REGISTER' ? 'New Toko' : status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* List Header */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <span>Menampilkan <strong>{filteredCoverages.length}</strong> toko</span>
          <div className="flex flex-col gap-1 items-end">
             <div className="text-[10px] text-slate-400">Warna = Hari, Bentuk = Frekuensi</div>
          </div>
        </div>

        {/* Store List */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-3 space-y-3">
          {loading ? (
            <div className="p-4 text-center text-slate-500 text-sm">Memuat data...</div>
          ) : filteredCoverages.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">Tidak ada toko yang ditemukan.</div>
          ) : (
            <>
              {filteredCoverages.slice(0, 200).map((store, index) => (
                <div 
                  key={store.id} 
                  onClick={() => {
                  if (store.latitude && store.longitude) {
                    setCenter([store.latitude, store.longitude]);
                  }
                }}
                className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 shrink-0 rounded flex items-center justify-center text-xs font-bold text-white ${
                    store.store_operational_status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-slate-800 text-sm truncate pr-2 group-hover:text-emerald-600 transition-colors">{store.customer_name}</h3>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${getStatusColor(store.store_operational_status)}`}>
                        {store.store_operational_status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mb-1 font-medium">#{store.customer_code} • {store.salesman_name?.split('-')[0]?.trim()}</div>
                    <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2 flex items-start gap-1">
                      <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                      {store.full_store_address}
                    </div>
                    {store.customer_phone && (
                      <div className="text-xs text-slate-500 mb-2 font-medium">
                        📞 {store.customer_phone}
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-2">
                      <div className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider">
                        {store.visit_day || '-'} {store.visit_frequency ? `(${store.visit_frequency})` : ''}
                      </div>
                      <div className={`text-[10px] font-bold flex items-center gap-1 ${store.latitude && store.longitude ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <MapPin className="w-3 h-3" />
                        {store.latitude && store.longitude ? 'GPS TERDATA' : 'TANPA GPS'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              ))}
              {filteredCoverages.length > 200 && (
                <div className="p-3 text-center text-xs text-slate-500 font-medium bg-slate-100 rounded-lg">
                  Menampilkan 200 dari {filteredCoverages.length} toko. Gunakan filter/pencarian untuk spesifik.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-slate-200 z-0">
        {validPoints.length > 1500 && salesmanCode === 'Semua' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-amber-200 text-amber-700 text-xs font-bold flex items-center gap-2">
            ⚠️ Terlalu banyak data. Menampilkan 1500 titik di peta. Pilih spesifik Salesman.
          </div>
        )}
        <MapContainer 
          center={center} 
          zoom={12} 
          className="w-full h-full"
          zoomControl={true}
        >
          <MapUpdater center={center} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {(() => {
            const pointsToRender = salesmanCode === 'Semua' ? validPoints.slice(0, 1500) : validPoints;
            const markers = pointsToRender.map((store, index) => (
              <Marker 
                key={store.id} 
                position={[store.latitude, store.longitude]}
                icon={getDynamicIcon(store.visit_day, store.visit_frequency)}
              >
                <Popup className="rounded-xl overflow-hidden shadow-xl" closeButton={false} autoPanPadding={[50, 50]}>
                  <div className="font-sans min-w-[200px] -m-5">
                    <div className={`p-4 text-white ${store.store_operational_status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                      <h3 className="font-bold text-sm m-0 leading-tight">{store.customer_name}</h3>
                      <p className="text-[11px] opacity-90 m-0 mt-1 font-medium">#{store.customer_code}</p>
                    </div>
                    <div className="p-4 bg-white">
                      <p className="text-xs text-slate-600 mb-3 leading-relaxed">{store.full_store_address}</p>
                      {store.customer_phone && <p className="text-xs font-bold mb-3 text-slate-700">📞 {store.customer_phone}</p>}
                      <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[100px]">{store.salesman_name?.split('(')[0]?.trim()}</span>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{store.visit_day} ({store.visit_frequency})</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ));

            if (salesmanCode === 'Semua') {
              return (
                <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
                  {markers}
                </MarkerClusterGroup>
              );
            }

            return <>{markers}</>;
          })()}
          
          <div className="absolute bottom-6 right-6 z-[1000] bg-white/95 backdrop-blur p-4 rounded-xl shadow-lg border border-slate-200 text-xs flex gap-8 transition-all hover:shadow-xl">
            <div>
              <div className="font-extrabold text-slate-800 mb-3 border-b border-slate-100 pb-1">WARNA HARI</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm border border-black/10"></span> <span className="font-medium text-slate-600">Senin</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm border border-black/10"></span> <span className="font-medium text-slate-600">Selasa</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm border border-black/10"></span> <span className="font-medium text-slate-600">Rabu</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500 shadow-sm border border-black/10"></span> <span className="font-medium text-slate-600">Kamis</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pink-500 shadow-sm border border-black/10"></span> <span className="font-medium text-slate-600">Jumat</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 shadow-sm border border-black/10"></span> <span className="font-medium text-slate-600">Sabtu</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-cyan-500 shadow-sm border border-black/10"></span> <span className="font-medium text-slate-600">Minggu</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-400 shadow-sm border border-black/10"></span> <span className="font-medium text-slate-600">Lainnya</span></div>
              </div>
            </div>
            <div className="border-l border-slate-200 pl-8">
              <div className="font-extrabold text-slate-800 mb-3 border-b border-slate-100 pb-1">BENTUK FREKUENSI</div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full bg-slate-500 shadow-sm border-2 border-white"></div> <span className="font-medium text-slate-600">Weekly (Bulat)</span></div>
                <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full border-4 border-slate-500 bg-white shadow-sm"></div> <span className="font-medium text-slate-600">Ganjil (Cincin)</span></div>
                <div className="flex items-center gap-3"><div className="w-4 h-4 rounded bg-slate-500 shadow-sm border-2 border-white"></div> <span className="font-medium text-slate-600">Genap (Kotak)</span></div>
              </div>
            </div>
          </div>
        </MapContainer>
        
        {/* Top Info Bar */}
        <div className="absolute top-4 left-4 right-4 z-[400] pointer-events-none flex justify-between items-start">
          <div className="bg-white/90 backdrop-blur border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg pointer-events-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="text-slate-400">Total Terdata:</span> {filteredCoverages.length} Toko</span>
            <div className="w-px h-4 bg-slate-300"></div>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> <span className="text-slate-400">Terpin GPS:</span> <span className="text-emerald-600">{validPoints.length} Titik</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
