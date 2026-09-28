const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.syncSetting.upsert({
    where: { module: 'rasiopiutangpersales' },
    update: {
      moduleName: 'Rasio Piutang Per Sales',
      endpoint: 'http://222.165.244.5/ords/padma/webapi/rasiopiutangpersales',
      scheduleType: 'daily',
      syncType: 'replace',
      isActive: true,
    },
    create: {
      module: 'rasiopiutangpersales',
      moduleName: 'Rasio Piutang Per Sales',
      endpoint: 'http://222.165.244.5/ords/padma/webapi/rasiopiutangpersales',
      scheduleType: 'daily',
      syncType: 'replace',
      isActive: true,
    }
  });
  console.log('Sync setting for rasiopiutangpersales added!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
