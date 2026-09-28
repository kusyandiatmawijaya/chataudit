const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const messages = await prisma.message.findMany({
    where: { sessionId: 'telegram-70c66257-53d4-4587-8037-d7ab2fbf82d8' }
  });
  console.log(`Found ${messages.length} messages for telegram-70c66257-53d4-4587-8037-d7ab2fbf82d8`);
  if (messages.length > 0) {
    console.log(`First message date: ${messages[0].timestamp}`);
    console.log(`Last message date: ${messages[messages.length-1].timestamp}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
