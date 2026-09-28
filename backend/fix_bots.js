const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const bots = await prisma.telegramBot.findMany({ where: { isActive: true } });
  const setting = await prisma.appSetting.findUnique({ where: { key: 'chatbot_enabled_sessions' } });
  let enabled = JSON.parse(setting?.value || '[]');
  
  for (const bot of bots) {
    const sid = 'telegram-' + bot.id;
    if (!enabled.includes(sid)) {
      enabled.push(sid);
    }
  }
  
  await prisma.appSetting.update({
    where: { key: 'chatbot_enabled_sessions' },
    data: { value: JSON.stringify(enabled) }
  });
  console.log('Updated. New value:', enabled);
}
run().catch(console.error).finally(() => prisma.$disconnect());
