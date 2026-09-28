const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const salesCoverageController = {
  getCoverages: async (req, res) => {
    try {
      const { salesman_code, visit_day, visit_frequency, store_operational_status } = req.query;

      const filter = {};
      if (salesman_code && salesman_code !== 'Semua') {
        filter.salesman_code = salesman_code;
      }
      if (visit_day && visit_day !== 'Semua Hari') {
        filter.visit_day = visit_day;
      }
      if (visit_frequency && visit_frequency !== 'Semua Frekuensi') {
        filter.visit_frequency = visit_frequency;
      }
      if (store_operational_status && store_operational_status !== 'Semua') {
        filter.store_operational_status = store_operational_status;
      }

      const queryOptions = { where: filter };
      
      // If "Semua Salesman" is selected, limit to 1500 to prevent browser crash from massive JSON payload
      if (!salesman_code || salesman_code === 'Semua') {
        queryOptions.take = 1500;
      }

      const coverages = await prisma.salesCoverage.findMany(queryOptions);

      res.json(coverages);
    } catch (error) {
      console.error('Error fetching sales coverages:', error);
      res.status(500).json({ error: 'Failed to fetch sales coverages' });
    }
  },

  getSalesmen: async (req, res) => {
    try {
      const salesmen = await prisma.$queryRaw`
        SELECT DISTINCT salesman_code, salesman_name
        FROM sales_coverages
        WHERE salesman_code IS NOT NULL
        ORDER BY salesman_name ASC
      `;
      res.json(salesmen);
    } catch (error) {
      console.error('Error fetching distinct salesmen:', error);
      res.status(500).json({ error: 'Failed to fetch salesmen' });
    }
  }
};

module.exports = salesCoverageController;
