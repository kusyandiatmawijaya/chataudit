const { PrismaClient } = require('@prisma/client');
const { runSyncProcess } = require('./controllers/syncController');
const prisma = new PrismaClient();

async function main() {
    const setting = await prisma.syncSetting.findUnique({
        where: { module: 'sales-coverages' }
    });
    
    if (!setting) {
        console.log('Setting not found');
        return;
    }

    console.log('Running sync for sales-coverages...');
    await runSyncProcess(setting, 'MANUAL');
    
    const count = await prisma.salesCoverage.count();
    console.log('Total SalesCoverage rows:', count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
