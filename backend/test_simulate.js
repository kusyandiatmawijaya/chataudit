const { PrismaClient } = require('@prisma/client');
const ReturnService = require('./services/ReturnService');
const p = new PrismaClient();

async function simulate() {
  const newTx = await p.returnTransaction.create({
    data: {
      returnNumber: 'TEST_' + Date.now(),
      customerCode: '0542',
      customerName: 'AYUB HAJI',
      salespersonCode: 'SBB103',
      returnType: 'TUNAI',
      status: 'SPV_APPROVED',
      items: {
        create: [
          {
            productCode: 'SB05',
            productName: 'BERAS PREMIUM SANIA 5 KG',
            uom: 'PCS',
            konversi: 1,
            price: 70000,
            totalPrice: 70000,
            qty: 1,
            qtyGood: 1,
            qtyBad: 0,
            originalQty: 1,
            alasan: 'Barang rusak'
          }
        ]
      }
    },
    include: { items: true }
  });

  console.log('1. Initial return created, items:', newTx.items.map(i => ({ id: i.id, code: i.productCode, name: i.productName, qty: i.qty })));

  let stateItems = newTx.items.map(it => ({
    ...it,
    price: it.price,
    totalPrice: it.totalPrice,
    _uoms: [{ label: it.uom, konversi: it.konversi, harga: it.price, price: it.price }]
  }));

  // Now Driver adds SB01
  const selectedProduct = {
    kdbrg: 'SB01',
    nmbrg: 'BERAS PREMIUM SANIA 1 KG',
    uoms: [{ label: 'PCS', konversi: 1, harga: 14700, price: 14700 }]
  };

  const existingUomMap = {};
  stateItems.forEach(it => {
    if (it.productCode === selectedProduct.kdbrg && !it.deletedAt && it.id) {
      existingUomMap[it.uom] = it.id;
    }
  });

  const newItems = [{
    id: existingUomMap['PCS'] || undefined,
    productCode: selectedProduct.kdbrg,
    productName: selectedProduct.nmbrg,
    uom: 'PCS',
    konversi: 1,
    price: 14700,
    totalPrice: 14700,
    qty: 1,
    qtyGood: 1,
    qtyBad: 0,
    alasan: 'Barang rusak',
    _uoms: selectedProduct.uoms
  }];

  stateItems = stateItems.filter(it => it.productCode !== selectedProduct.kdbrg);
  stateItems.push(...newItems);

  console.log('2. State items in frontend after adding SB01:', stateItems.map(i => ({ id: i.id, code: i.productCode, qty: i.qty })));

  const activeItems = stateItems.filter(it => !it.deletedAt && it.qty > 0);
  console.log('3. activeItems to send:', activeItems.map(i => ({ id: i.id, code: i.productCode, qty: i.qty })));

  const updated = await ReturnService.addItemsToReturn(newTx.id, activeItems, 'Driver/Kenek', {
    action: 'DRIVER_EDITED_ITEMS',
    role: 'Driver/Kenek',
    name: 'Driver'
  });

  console.log('4. Items in updatedTx from DB:', updated.items.map(i => ({ id: i.id, code: i.productCode, name: i.productName, qty: i.qty, del: i.deletedAt })));

  // Cleanup
  await p.returnItem.deleteMany({ where: { returnTransactionId: newTx.id } });
  await p.returnHistory.deleteMany({ where: { returnTransactionId: newTx.id } });
  await p.returnTransaction.delete({ where: { id: newTx.id } });
}

simulate().finally(() => p.$disconnect());
