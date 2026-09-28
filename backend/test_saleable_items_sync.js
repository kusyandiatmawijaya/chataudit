const { PrismaClient } = require('@prisma/client');
const { runSyncProcess } = require('./controllers/syncController');
const prisma = new PrismaClient();

async function main() {
  const setting = await prisma.syncSetting.findUnique({
    where: { module: 'saleable-items' }
  });

  if (!setting) {
    console.error('Setting not found for saleable-items');
    return;
  }

  console.log('Starting sync for saleable-items with setting:', {
    module: setting.module,
    endpoint: setting.endpoint,
    scheduleType: setting.scheduleType,
    syncType: setting.syncType,
    authUsername: setting.authUsername,
  });

  const t0 = Date.now();
  await runSyncProcess(setting, 'MANUAL');
  console.log(`Sync completed in ${(Date.now() - t0)/1000}s`);

  const count = await prisma.saleableItem.count();
  console.log('Total rows in saleable_items table:', count);

  const sample = await prisma.saleableItem.findFirst({
    where: { product_code: { not: null } }
  });
  console.log('Sample row:', sample);

  const log = await prisma.syncLog.findFirst({
    where: { module: 'saleable-items' },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Latest sync log:', log);
}

main().catch(console.error).finally(() => prisma.$disconnect());
