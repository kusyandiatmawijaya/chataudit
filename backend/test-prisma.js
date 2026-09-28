const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  try {
    console.log(Object.keys(prisma));
    const promos = await prisma.promo.findMany();
    console.log('Success:', promos);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
