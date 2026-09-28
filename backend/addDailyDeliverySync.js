const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.syncSetting.upsert({
    where: { module: 'daily-deliveries' },
    update: {
      moduleName: 'Daily Deliveries',
      endpoint: 'http://222.165.244.5/ords/padma/webapi/daily-deliveries',
      scheduleType: '6_hours',
      syncType: 'replace',
      isActive: true,
    },
    create: {
      module: 'daily-deliveries',
      moduleName: 'Daily Deliveries',
      endpoint: 'http://222.165.244.5/ords/padma/webapi/daily-deliveries',
      scheduleType: '6_hours',
      syncType: 'replace',
      isActive: true,
    }
  });
  console.log('Sync setting added/updated for daily-deliveries');
}

main().catch(console.error).finally(() => prisma.$disconnect());
