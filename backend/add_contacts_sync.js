const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const setting = await prisma.syncSetting.upsert({
    where: { module: 'contacts_push' },
    update: {
      moduleName: 'Contacts Push to Server',
      endpoint: 'http://222.165.244.5/ords/padma/webapi/sync/contacts',
      scheduleType: 'hourly',
      syncType: 'push',
      isActive: true,
    },
    create: {
      module: 'contacts_push',
      moduleName: 'Contacts Push to Server',
      endpoint: 'http://222.165.244.5/ords/padma/webapi/sync/contacts',
      scheduleType: 'hourly',
      syncType: 'push',
      isActive: true,
      authUsername: 'padma', // Usually the UI sets this, but let's leave it null or same as others. Wait, I will copy auth from another setting.
    }
  });
  console.log('Sync setting for contacts_push created/updated:', setting);
}

main().catch(console.error).finally(() => prisma.$disconnect());
