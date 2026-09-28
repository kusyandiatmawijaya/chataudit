const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simple helper to calculate similarity if needed, or just rely on ILIKE
function getMatchingProduct(products, keyword) {
  const kw = keyword.toLowerCase().trim();
  // Try exact match first
  let match = products.find(p => p.product_name && p.product_name.toLowerCase().includes(kw));
  if (match) return match;
  
  // Try matching words
  const words = kw.split(' ');
  match = products.find(p => {
    if (!p.product_name) return false;
    const name = p.product_name.toLowerCase();
    return words.every(w => name.includes(w));
  });
  return match;
}

function getUnitInfo(item, unitKeyword) {
  const defaultUnit = { name: item.unit_1_name || 'PCS', price: item.unit_1_selling_price || 0, qtyPerPcs: item.unit_1_qty_per_pcs || 1 };
  
  if (!unitKeyword) return defaultUnit;
  
  let kw = unitKeyword.toLowerCase().trim();
  
  const aliases = {
    'pak': 'pack',
    'dus': 'ctn',
    'kardus': 'ctn',
    'karton': 'ctn',
    'renceng': 'rcng',
    'bungkus': 'bks',
    'botol': 'btl'
  };
  
  if (aliases[kw]) {
    kw = aliases[kw];
  }
  
  for (let i = 1; i <= 4; i++) {
    const uName = item[`unit_${i}_name`];
    if (uName && uName.toLowerCase().includes(kw)) {
      return {
        name: uName,
        price: item[`unit_${i}_selling_price`] || 0,
        qtyPerPcs: item[`unit_${i}_qty_per_pcs`] || 1
      };
    }
  }
  
  return defaultUnit;
}

async function handleExtractedOrder(contactId, extractedItems) {
  try {
    const validItems = [];
    const outOfStockItems = [];
    const unrecognizedItems = [];
    let grandTotal = 0;

    // Fetch all products into memory if it's small, or query per item
    // Since we don't know the size, we'll query per item
    for (const reqItem of extractedItems) {
      const { product_name, quantity, unit, action } = reqItem;
      const act = (action || 'add').toLowerCase();
      const qty = parseInt(quantity) || 0;
      
      if (act !== 'remove' && qty <= 0) continue;

      // Query database with basic ILIKE using first word to get candidates
      const words = product_name.split(' ').filter(w => w.trim().length > 0);
      let candidates = [];
      
      if (words.length > 0) {
        candidates = await prisma.orderableItem.findMany({
          where: {
            product_name: {
              contains: words[0],
              mode: 'insensitive'
            }
          }
        });
      }

      const match = getMatchingProduct(candidates, product_name);

      if (!match) {
        unrecognizedItems.push({ requested_name: product_name, quantity: qty, unit });
        continue;
      }

      const unitInfo = getUnitInfo(match, unit);
      const totalPcsNeeded = qty * unitInfo.qtyPerPcs;

      if ((match.total_available_pcs || 0) < totalPcsNeeded) {
        outOfStockItems.push({
          requested_name: product_name,
          matched_db_name: match.product_name,
          requested_qty: qty,
          unit: unitInfo.name,
          available_pcs: match.total_available_pcs
        });
        continue;
      }

      const subtotal = qty * unitInfo.price;
      grandTotal += subtotal;

      validItems.push({
        productId: match.product_id,
        db_name: match.product_name,
        qty: qty,
        unit: unitInfo.name,
        unitPrice: unitInfo.price,
        subtotal: subtotal,
        action: act
      });
    }

    // Fetch existing cart
    let currentCart = await prisma.cart.findUnique({
      where: { contactId }
    });

    let existingItems = currentCart ? (typeof currentCart.items === 'string' ? JSON.parse(currentCart.items) : currentCart.items) : [];
    if (!Array.isArray(existingItems)) existingItems = [];

    let removedItems = [];
    let updatedItems = [];

    // Process items (add, update, remove)
    for (const newItem of validItems) {
      if (newItem.action === 'remove') {
        const initialLen = existingItems.length;
        existingItems = existingItems.filter(i => i.productId !== newItem.productId);
        if (existingItems.length < initialLen) removedItems.push(newItem);
      } else if (newItem.action === 'update') {
        existingItems = existingItems.filter(i => i.productId !== newItem.productId);
        existingItems.push(newItem);
        updatedItems.push(newItem);
      } else {
        const idx = existingItems.findIndex(i => i.productId === newItem.productId && i.unit === newItem.unit);
        if (idx >= 0) {
          existingItems[idx].qty += newItem.qty;
          existingItems[idx].subtotal += newItem.subtotal;
        } else {
          existingItems.push(newItem);
        }
      }
    }

    const newGrandTotal = existingItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Upsert or Delete Cart
    if (existingItems.length > 0) {
      await prisma.cart.upsert({
        where: { contactId },
        update: {
          items: existingItems,
          totalAmount: newGrandTotal,
          updatedAt: new Date()
        },
        create: {
          contactId,
          items: existingItems,
          totalAmount: newGrandTotal
        }
      });
    } else if (currentCart) {
      await prisma.cart.delete({ where: { contactId } });
    }

    // Format the response back to the LLM (Instruction changed to NOT show full summary)
    return JSON.stringify({
      status: 'success',
      added_now: validItems.filter(i => i.action === 'add'),
      updated_now: updatedItems,
      removed_now: removedItems,
      current_total_items_in_cart: existingItems.length,
      out_of_stock: outOfStockItems,
      unrecognized_items: unrecognizedItems,
      instruction_to_llm: "JANGAN MENAMPILKAN CART SUMMARY LENGKAP. Konfirmasi singkat barang yang baru ditambah, diupdate (diganti), atau dihapus. Jika list tersebut kosong, sebutkan alasan dari out_of_stock/unrecognized. Tanyakan 'Ada tambahan lagi?'. JANGAN sebutkan total harga."
    });

  } catch (error) {
    console.error('[OrderService] Error handling extracted order:', error);
    return JSON.stringify({ error: 'Terjadi kesalahan sistem saat memproses pesanan.' });
  }
}

async function viewCartSummary(contactId) {
  try {
    const cart = await prisma.cart.findUnique({
      where: { contactId }
    });
    if (!cart || !cart.items || cart.items.length === 0) {
      return JSON.stringify({ status: 'empty', message: 'Keranjang belanja kosong.' });
    }

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    let customerName = contact?.name || 'Unknown';
    let customerCode = contact?.kodeCustomer || 'Belum Terdaftar';
    
    if (contact?.kodeCustomer) {
      const customer = await prisma.customer.findFirst({ where: { kdcust: contact.kodeCustomer } });
      if (customer) {
        // Clean trailing "(SOS)" if any, though it's optional
        customerName = customer.nmcust.replace(/\s*\(SOS\)/gi, '').trim();
      }
    }
    
    const orderDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    return JSON.stringify({
      status: 'success',
      customer_info: {
        tanggal_pesan: orderDate,
        kode_customer: customerCode,
        nama_customer: customerName
      },
      items: cart.items,
      grand_total: cart.totalAmount,
      instruction_to_llm: "WAJIB gunakan judul *PESANAN BARANG*. Di bagian atas nota, cantumkan Tanggal Pesan, Kode Customer, dan Nama Customer yang diambil dari object customer_info. Tampilkan CART SUMMARY menyalin format ini secara persis: '- [db_name]: [qty] [unit], Subtotal: Rp [subtotal]'. DILARANG KERAS menjabarkan atau mengalikan harga satuan sendiri, cukup salin subtotal dari data. Tampilkan Total Akhir sesuai grand_total. Lalu tanyakan: 'Apakah pesanan ini sudah benar dan siap diproses?'"
    });
  } catch (error) {
    console.error('[OrderService] Error viewing cart:', error);
    return JSON.stringify({ error: 'Gagal mengambil data keranjang.' });
  }
}

async function clearCart(contactId) {
  try {
    await prisma.cart.delete({
      where: { contactId }
    });
    return JSON.stringify({ status: 'success', message: 'Keranjang berhasil dikosongkan.' });
  } catch (error) {
    // If record doesn't exist, prisma throws. We can ignore or check first.
    return JSON.stringify({ status: 'success', message: 'Keranjang sudah kosong.' });
  }
}

async function checkoutOrder(contactId) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    });

    if (!contact || !contact.kodeCustomer) {
      return JSON.stringify({ error: 'Tidak dapat memproses checkout: Kode Customer tidak ditemukan. Harap pastikan identitas toko telah dikonfirmasi.' });
    }

    const cart = await prisma.cart.findUnique({
      where: { contactId }
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return JSON.stringify({ error: 'Tidak dapat memproses checkout: Keranjang belanja kosong.' });
    }

    const items = typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items;
    
    // Generate simple SO number
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const soNumber = `SO-${dateStr}-${randomNum}`;

    const salesOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.create({
        data: {
          so_number: soNumber,
          kdcust: contact.kodeCustomer,
          kdsls: contact.kodeSales || null,
          contactId: contactId,
          total_amount: cart.totalAmount,
          status: 'PENDING'
        }
      });

      for (const item of items) {
        await tx.salesOrderItem.create({
          data: {
            so_id: order.id,
            product_id: item.productId,
            product_name: item.db_name || item.product_name || '',
            qty: item.qty,
            unit: item.unit,
            unit_price: item.unitPrice,
            subtotal: item.subtotal
          }
        });
      }

      await tx.cart.delete({
        where: { contactId }
      });

      return order;
    });

    return JSON.stringify({
      status: 'success',
      so_number: salesOrder.so_number,
      total_amount: salesOrder.total_amount,
      pesan_untuk_ai: `Buat kalimat penutup dengan natural (JANGAN copas kalimat ini). Informasikan ke pengguna bahwa pesanan berhasil diproses dengan Nomor SO: ${salesOrder.so_number}. Ucapkan terima kasih.`
    });

  } catch (error) {
    console.error('[OrderService] Error in checkoutOrder:', error);
    return JSON.stringify({ error: 'Terjadi kesalahan sistem saat memproses checkout pesanan.' });
  }
}

module.exports = {
  handleExtractedOrder,
  viewCartSummary,
  clearCart,
  checkoutOrder
};
