const orderTools = [
  {
    type: 'function',
    function: {
      name: 'extract_and_check_order',
      description: 'Trigger this tool whenever the user wants to buy products, place an order, or add items to their cart. Pass the extracted items as an array. This tool will check the product against the database, calculate prices, and return a Cart Summary. DO NOT calculate prices or guess products yourself.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'List of items the user wants to order.',
            items: {
              type: 'object',
              properties: {
                product_name: {
                  type: 'string',
                  description: 'The name of the product the user wants to buy (e.g. "Pop Ice Coklat").'
                },
                quantity: {
                  type: 'number',
                  description: 'The quantity requested (e.g. 5). Set to 0 if action is "remove".'
                },
                unit: {
                  type: 'string',
                  description: 'The unit of measurement if provided (e.g. "dus", "renceng", "pcs"). If not specified, leave empty.'
                },
                action: {
                  type: 'string',
                  description: 'Action to perform: "add" (tambah), "update" (timpa/ganti qty), "remove" (hapus dari keranjang). Default is "add".'
                }
              },
              required: ['product_name']
            }
          }
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'view_cart_summary',
      description: 'Gunakan tool ini ketika pelanggan mengatakan "selesai", "sudah", "itu aja", atau meminta "total" dari pesanannya. Tool ini akan mengembalikan data keranjang belanja terakhir.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_cart',
      description: 'Gunakan tool ini jika pelanggan ingin membatalkan pesanan atau mengosongkan keranjang belanjanya.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'checkout_order',
      description: 'Gunakan tool ini HANYA JIKA pelanggan sudah setuju dan mengonfirmasi Cart Summary dengan berkata "Ya", "Proses", "Oke", atau "Lanjut". Tool ini akan menyimpan pesanan resmi ke database dan menghasilkan Nomor SO.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  }
];

module.exports = {
  orderTools
};
