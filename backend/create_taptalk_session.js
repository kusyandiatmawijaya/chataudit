const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany();
    const devUser = users.find(u => u.username === 'kusyandi') || users[0];
    if (!devUser) {
      console.log('No user found to link session to.');
      return;
    }
    await prisma.session.upsert({
      where: { sessionId: 'taptalk' },
      update: { name: 'TapTalk / OneTalk', status: 'ready' },
      create: { 
        sessionId: 'taptalk', 
        name: 'TapTalk / OneTalk', 
        status: 'ready', 
        users: { connect: { id: devUser.id } } 
      }
    });
    console.log('TapTalk session created or updated successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}
main();
