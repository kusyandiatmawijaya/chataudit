const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get dynamic filter parameters for dashboard
router.get('/filters', async (req, res) => {
  try {
    // Get Tahun Awal from system parameters
    let startYear = 2020;
    const tahunAwalSetting = await prisma.appSetting.findFirst({
      where: {
        key: {
          in: ['tahun_awal', 'TAHUN_AWAL', 'Tahun Awal', 'tahunawal', 'TAHUNAWAL']
        }
      }
    });

    if (tahunAwalSetting && !isNaN(parseInt(tahunAwalSetting.value))) {
      startYear = parseInt(tahunAwalSetting.value);
    } else {
      // fallback to minimum year in data if no parameter
      const minDataYear = await prisma.rasioPiutangPerSales.aggregate({
        _min: { tahun: true }
      });
      if (minDataYear._min.tahun) {
        startYear = Math.min(startYear, minDataYear._min.tahun);
      }
    }

    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= startYear; y--) {
      years.push({ value: y, label: String(y) });
    }

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const months = monthNames.map((name, index) => ({
      value: index + 1,
      label: `${index + 1} ${name}`
    }));

    const divisions = await prisma.rasioPiutangPerSales.findMany({
      select: { divisi: true },
      distinct: ['divisi'],
      where: { divisi: { not: null } },
      orderBy: { divisi: 'asc' }
    });

    const salesmen = await prisma.rasioPiutangPerSales.findMany({
      select: { kode_sales: true, nama_sales: true },
      distinct: ['kode_sales'],
      where: { kode_sales: { not: null } },
      orderBy: { kode_sales: 'asc' }
    });

    res.json({
      years: years,
      months: months,
      divisions: divisions.map(d => ({ value: d.divisi, label: d.divisi })),
      salesmen: salesmen.map(s => ({ 
        value: s.kode_sales, 
        label: s.nama_sales ? `${s.kode_sales} - ${s.nama_sales}` : s.kode_sales 
      }))
    });
  } catch (error) {
    console.error('Error fetching dashboard filters:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard filters' });
  }
});

// Get all dashboards
router.get('/', async (req, res) => {
  try {
    const dashboards = await prisma.dashboard.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(dashboards);
  } catch (error) {
    console.error('Error fetching dashboards:', error);
    res.status(500).json({ error: 'Failed to fetch dashboards' });
  }
});

// Create a new dashboard
router.post('/', async (req, res) => {
  try {
    const { name, description, isDefault } = req.body;
    
    // If setting as default, unset others
    if (isDefault) {
      await prisma.dashboard.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const dashboard = await prisma.dashboard.create({
      data: {
        name: name || 'New Dashboard',
        description: description || '',
        isDefault: isDefault || false
      }
    });
    res.status(201).json(dashboard);
  } catch (error) {
    console.error('Error creating dashboard:', error);
    res.status(500).json({ error: 'Failed to create dashboard' });
  }
});

// Get a specific dashboard with widgets
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dashboard = await prisma.dashboard.findUnique({
      where: { id },
      include: {
        widgets: true
      }
    });

    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Update a dashboard
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isDefault } = req.body;

    if (isDefault) {
      await prisma.dashboard.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false }
      });
    }

    const dashboard = await prisma.dashboard.update({
      where: { id },
      data: { name, description, isDefault }
    });
    res.json(dashboard);
  } catch (error) {
    console.error('Error updating dashboard:', error);
    res.status(500).json({ error: 'Failed to update dashboard' });
  }
});

// Delete a dashboard
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.dashboard.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    res.status(500).json({ error: 'Failed to delete dashboard' });
  }
});

// Update all widgets for a dashboard
router.put('/:id/widgets', async (req, res) => {
  try {
    const { id } = req.params;
    const { widgets } = req.body; // Array of widgets

    if (!Array.isArray(widgets)) {
      return res.status(400).json({ error: 'Widgets must be an array' });
    }

    // Delete existing widgets for the dashboard
    await prisma.widget.deleteMany({
      where: { dashboardId: id }
    });

    // Create new widgets
    const createdWidgets = await Promise.all(
      widgets.map((widget) =>
        prisma.widget.create({
          data: {
            dashboardId: id,
            title: widget.title || 'Untitled Widget',
            type: widget.type,
            dataSource: widget.dataSource,
            configJson: widget.configJson || {},
            layoutJson: widget.layoutJson || {}
          }
        })
      )
    );

    res.json(createdWidgets);
  } catch (error) {
    console.error('Error updating widgets:', error);
    res.status(500).json({ error: 'Failed to update widgets' });
  }
});

// Data fetching endpoint for widgets
router.post('/data', async (req, res) => {
  try {
    const { dataSource, filters } = req.body;
    
    // Simulate querying a materialized view using existing tables.
    // In a real scenario, this would query a specific materialized view like mv_sales_collection_summary
    
    let result = [];
    
    // Legacy hardcoded mock for backward compatibility
    if (dataSource === 'SALES_COLLECTION_SUMMARY') {
      const where = {};
      if (filters) {
        if (filters.year && filters.year !== 'all') {
          where.tahun = Number(filters.year);
        }
        if (filters.dateRange && filters.dateRange !== 'all') {
          where.bulan = Number(filters.dateRange);
        }
        if (filters.division && filters.division !== 'all') {
          where.divisi = filters.division;
        }
        if (filters.salesman && filters.salesman !== 'all') {
          where.kode_sales = filters.salesman;
        }
      }

      const kpiData = await prisma.rasioPiutangPerSales.aggregate({
        _sum: {
          jumlah_piutang: true,
          jumlah_bayar: true,
          jumlah_sisa: true,
        },
        where
      });

      const totalAR = kpiData._sum.jumlah_piutang || 0;
      const totalPaid = kpiData._sum.jumlah_bayar || 0;
      const totalBalance = kpiData._sum.jumlah_sisa || 0;
      const collectionRate = totalAR > 0 ? (totalPaid / totalAR) * 100 : 0;

      const kpis = { totalAR, totalPaid, totalBalance, collectionRate };

      const timeSeries = await prisma.rasioPiutangPerSales.groupBy({
        by: ['periode'],
        _sum: {
          jumlah_piutang: true,
          jumlah_bayar: true
        },
        where,
        orderBy: {
          periode: 'asc'
        }
      });

      const timeSeriesData = timeSeries.map(item => ({
        month: item.periode,
        sales: item._sum.jumlah_piutang || 0,
        collection: item._sum.jumlah_bayar || 0
      }));
      
      const categories = await prisma.rasioPiutangPerSales.groupBy({
        by: ['divisi'],
        _sum: {
          jumlah_piutang: true
        },
        where,
      });

      const categoryData = categories.filter(c => c.divisi).map(item => ({
        name: item.divisi,
        value: item._sum.jumlah_piutang || 0
      }));
      
      const tableData = await prisma.rasioPiutangPerSales.findMany({
        where,
        take: 20,
        orderBy: { jumlah_sisa: 'desc' }
      });

      result = { kpis, timeSeriesData, categoryData, tableData };
    } else {
      // Look up dynamic data source
      const ds = await prisma.dataSource.findFirst({
        where: { name: dataSource }
      });
      
      if (ds && ds.query) {
        try {
          let dynamicQuery = ds.query.trim();
          // Remove SQL comments to prevent regex from matching commented keywords
          dynamicQuery = dynamicQuery.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();

          if (dynamicQuery.endsWith(';')) {
            dynamicQuery = dynamicQuery.slice(0, -1);
          }
          
          // Inject dynamic filters if present
          if (filters) {
            const conditions = [];
            
            const paramsStr = ds.dynamicParams !== null && ds.dynamicParams !== undefined ? ds.dynamicParams : "tahun,bulan";
            const validParams = paramsStr.split(',').map(s => s.trim()).filter(Boolean);

            if (validParams.includes('tahun') && filters.year && filters.year !== 'all') {
              conditions.push(`tahun = ${Number(filters.year)}`);
            }
            if (validParams.includes('bulan') && filters.dateRange && filters.dateRange !== 'all') {
              conditions.push(`bulan = ${Number(filters.dateRange)}`);
            }
            if (validParams.includes('divisi') && filters.division && filters.division !== 'all') {
              const div = filters.division.replace(/'/g, "''");
              conditions.push(`divisi = '${div}'`);
            }
            if (validParams.includes('kode_sales') && filters.salesman && filters.salesman !== 'all') {
              const sales = filters.salesman.replace(/'/g, "''");
              conditions.push(`kode_sales = '${sales}'`);
            }
            
            if (conditions.length > 0) {
              const filterStr = conditions.join(' AND ');
              
              // Simple SQL injection logic
              const whereRegex = /\bWHERE\b/i;
              if (whereRegex.test(dynamicQuery)) {
                // If it already has WHERE, inject before the existing WHERE conditions
                dynamicQuery = dynamicQuery.replace(whereRegex, `WHERE (${filterStr}) AND `);
              } else {
                // If it doesn't have WHERE, inject before GROUP BY, ORDER BY, LIMIT, or at the end
                const keywordsRegex = /\b(GROUP BY|ORDER BY|LIMIT)\b/i;
                const match = dynamicQuery.match(keywordsRegex);
                if (match) {
                  dynamicQuery = dynamicQuery.replace(keywordsRegex, `WHERE ${filterStr} ${match[0]}`);
                } else {
                  dynamicQuery += ` WHERE ${filterStr}`;
                }
              }
            }
          }

          // Execute raw SQL query. 
          // Note: In production, ensure this is wrapped in read-only mode if possible.
          let rawData = await prisma.$queryRawUnsafe(dynamicQuery);
          
          // Auto-flatten logic for single-column JSON returns
          if (Array.isArray(rawData) && rawData.length > 0) {
            const keys = Object.keys(rawData[0]);
            if (keys.length === 1) {
              const firstVal = rawData[0][keys[0]];
              if (firstVal !== null && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
                rawData = rawData.map(row => row[keys[0]]);
              }
            }
          }
          
          // Structure the result generically based on widget types
          // We provide the raw array so different widgets can map it via their configJson (xAxisKey, yAxisKeys, metric)
          result = {
            kpis: rawData.length > 0 ? rawData[0] : {},
            timeSeriesData: rawData,
            categoryData: rawData,
            tableData: rawData,
            rawData: rawData
          };
        } catch (dbError) {
          console.error(`Error executing dynamic query for ${dataSource}:`, dbError);
          result = { error: 'Failed to execute query', details: dbError.message };
        }
      } else {
        result = { error: 'Unknown or missing data source' };
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching widget data:', error);
    res.status(500).json({ error: 'Failed to fetch widget data' });
  }
});

module.exports = router;
