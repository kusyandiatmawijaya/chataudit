const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.syncSetting.upsert({
    where: { module: 'saleable-items' },
    update: {
      moduleName: 'Saleable Items',
      endpoint: 'http://222.165.244.5/ords/padma/webapi/master/saleable-items',
      authUsername: 'gs',
      authPassword: 'Padma23#@!',
      scheduleType: '6_hours',
      syncType: 'replace',
      isActive: true,
    },
    create: {
      module: 'saleable-items',
      moduleName: 'Saleable Items',
      endpoint: 'http://222.165.244.5/ords/padma/webapi/master/saleable-items',
      authUsername: 'gs',
      authPassword: 'Padma23#@!',
      scheduleType: '6_hours',
      syncType: 'replace',
      isActive: true,
    }
  });
  console.log('Sync setting added/updated for saleable-items:', result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
