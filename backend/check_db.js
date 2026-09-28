const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const data = await prisma.addDiscountEnesis.findMany({
        where: { kdcust: "10823" }
    });
    console.log(`Found ${data.length} records for kdcust 10823`);
    if (data.length > 0) {
        console.log("Sample record phone:", data[0].phone);
        
        // Find distinct phones
        const phones = [...new Set(data.map(d => d.phone))];
        console.log("Distinct phones for this kdcust:", phones);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
