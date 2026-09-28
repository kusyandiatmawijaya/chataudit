const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.syncSetting.upsert({
    where: { module: 'sales-coverages' },
    update: {
      moduleName: 'Sales Coverage',
      endpoint: 'http://222.165.244.5/ords/padma/webapi/salesman/sales-coverages',
      authUsername: 'gs',
      authPassword: 'Padma23#@!',
      scheduleType: '6_hours',
      syncType: 'replace',
      isActive: true,
    },
    create: {
      module: 'sales-coverages',
      moduleName: 'Sales Coverage',
      endpoint: 'http://222.165.244.5/ords/padma/webapi/salesman/sales-coverages',
      authUsername: 'gs',
      authPassword: 'Padma23#@!',
      scheduleType: '6_hours',
      syncType: 'replace',
      isActive: true,
    }
  });
  console.log('Sync setting added/updated for sales-coverages');
}

main().catch(console.error).finally(() => prisma.$disconnect());
