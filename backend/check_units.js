const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.orderableItem.findMany({
    where: { product_name: { contains: 'POP ICE' } },
    take: 5
  });
  console.log(JSON.stringify(items, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
