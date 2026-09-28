const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const keywords = "anjing,anj1ng,njing,babi,b4b1,monyet,bangsat,bajingan,asu,a5u,kontol,kntl,memek,ngentot,ngewe,peler,puki,lonte,pelacur,pantek,goblok,g0bl0k,tolol,idiot,slot,gacor,maxwin,depo,zeus,pinjol,pesugihan,judi online,judol";
  
  await prisma.appSetting.upsert({
    where: { key: 'banned_keywords' },
    update: { value: keywords },
    create: { key: 'banned_keywords', value: keywords }
  });
  
  console.log("Seeded banned_keywords successfully.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
