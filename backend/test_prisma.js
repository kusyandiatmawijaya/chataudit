const { Prisma } = require('@prisma/client');

const models = Prisma.dmmf.datamodel.models;
const catalog = models.map(m => {
  return {
    name: m.dbName || m.name, // use mapped table name if exists
    fields: m.fields.map(f => `${f.dbName || f.name} (${f.type})`).join(', ')
  };
});

console.log(JSON.stringify(catalog.slice(0, 2), null, 2));
