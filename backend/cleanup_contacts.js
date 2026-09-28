const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  const contacts = await prisma.contact.findMany();
  
  // Group by phoneNumber
  const grouped = {};
  for (const c of contacts) {
    if (!grouped[c.phoneNumber]) grouped[c.phoneNumber] = [];
    grouped[c.phoneNumber].push(c);
  }

  let deletedCount = 0;

  for (const phone in grouped) {
    const list = grouped[phone];
    if (list.length > 1) {
      // Sort to determine which one to keep
      // Priority: 1. Has group, 2. isAllowed true, 3. @s.whatsapp.net over @lid, 4. latest updated
      list.sort((a, b) => {
        if ((a.group !== null) !== (b.group !== null)) return a.group !== null ? -1 : 1;
        if (a.isAllowed !== b.isAllowed) return a.isAllowed ? -1 : 1;
        
        const aIsStd = a.whatsappId.includes('@s.whatsapp.net');
        const bIsStd = b.whatsappId.includes('@s.whatsapp.net');
        if (aIsStd !== bIsStd) return aIsStd ? -1 : 1;
        
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      const keep = list[0];
      const removeList = list.slice(1);

      for (const toRemove of removeList) {
        try {
          await prisma.contact.delete({ where: { id: toRemove.id } });
          deletedCount++;
          console.log(`Deleted duplicate: ${toRemove.name} (${toRemove.whatsappId}) - Kept: ${keep.whatsappId}`);
        } catch (err) {
          console.error(`Failed to delete ${toRemove.id}: ${err.message}`);
        }
      }
    }
  }

  console.log(`Cleanup complete. Deleted ${deletedCount} duplicate contacts.`);
  await prisma.$disconnect();
}

cleanup();
