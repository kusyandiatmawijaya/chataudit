const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ex = await prisma.syncSetting.findFirst({ where: { module: 'customers' }});
  const authUsername = ex ? ex.authUsername : null;
  const authPassword = ex ? ex.authPassword : null;
  
  const setting = await prisma.syncSetting.update({
    where: { module: 'contacts_push' },
    data: { authUsername, authPassword }
  });
  console.log('Sync setting auth updated:', setting);
}

main().catch(console.error).finally(() => prisma.$disconnect());
