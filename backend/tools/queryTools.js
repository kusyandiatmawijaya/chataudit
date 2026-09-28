const { orderTools } = require('./orderTools');

const INTERNAL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_outstanding_ar',
      description: 'WAJIB DIGUNAKAN saat pengguna menanyakan tentang Outstanding AR (piutang), tagihan, atau saldo hutang. JANGAN panggil get_product_catalog untuk tagihan! Tool ini khusus untuk mengecek tagihan toko.',
      parameters: {
        type: 'object',
        properties: {
          kode_toko: {
            type: 'string',
            description: 'Kode toko (kdcust) atau nama toko (nmcust) yang ingin dicek piutangnya.',
          },
        },
        required: ['kode_toko'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_credit_limit_analysis',
      description: 'Mengambil data analisa credit limit (OCL) untuk sebuah toko/customer berdasarkan kode toko atau nama toko. Gunakan tool ini saat user menanyakan credit limit, limit kredit, OCL, analisa kredit, atau kapasitas order toko.',
      parameters: {
        type: 'object',
        properties: {
          kode_toko: {
            type: 'string',
            description: 'Kode toko (kdcust) atau nama toko (nmcust) yang ingin dicek credit limitnya. Bisa dikosongkan jika pengguna menanyakan datanya sendiri.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_outstanding_ar_by_salesman',
      description: 'Mengambil data Outstanding AR (piutang) berdasarkan kode sales atau nama sales. Gunakan tool ini jika user menanyakan tagihan/piutang salesman, atau meminta ANALISA SALESMAN (misal: "Analisa salesman Zailin").',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Kode sales (kdsls) atau nama sales (nmsls). Bisa dikosongkan jika pengguna adalah salesman yang menanyakan datanya sendiri.',
          },
          limit: {
            type: 'number',
            description: 'Jumlah maksimal data yang dikembalikan. Jika user ingin semua data, isi dengan 9999. Default 10.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_outstanding_ar_summary_per_salesman',
      description: 'Menarik data rekap/total piutang (Outstanding AR) yang dikelompokkan per salesman. Gunakan ini jika user menanyakan "total tagihan semua sales" atau "rekap piutang masing-masing salesman".',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_invoice_detail',
      description: 'Mencari detail faktur/nota spesifik beserta nominal tagihan, sisa pembayaran, dan status jatuh tempo.',
      parameters: {
        type: 'object',
        properties: {
          nomor_faktur: {
            type: 'string',
            description: 'Nomor faktur / invoice (misal: INV-12345, FAK-098).',
          },
        },
        required: ['nomor_faktur'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_store_profile_and_location',
      description: 'Mengambil detail alamat, kontak, latitude, dan longitude dari sebuah toko berdasarkan nama atau kode toko.',
      parameters: {
        type: 'object',
        properties: {
          kode_toko: {
            type: 'string',
            description: 'Kode toko (kdcust) atau nama toko. Bisa dikosongkan jika pengguna menanyakan data profilnya sendiri.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_payment_receipts',
      description: 'Mengecek apakah ada transfer atau pembayaran masuk dari mutasi rekening OCR. Gunakan untuk menjawab pertanyaan transfer dari pelanggan.',
      parameters: {
        type: 'object',
        properties: {
          nominal: {
            type: 'number',
            description: 'Nominal transfer/pembayaran.',
          },
          kata_kunci: {
            type: 'string',
            description: 'Kata kunci opsional seperti nama bank (BCA/Mandiri) atau berita pesan.',
          }
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bad_debt_or_overdue_stores',
      description: 'Menampilkan daftar toko yang kreditnya macet (bad debt) atau overduenya parah.',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Kode atau nama sales untuk memfilter toko bad debt di rute sales tersebut.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sales_performance_report',
      description: 'Mengambil rapor performa chat (Report Card) terbaru dari seorang salesman berdasarkan kode, nama, atau nomor HP.',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Kode sales, nama sales, atau nomor HP sales. Bisa dikosongkan jika pengguna menanyakan performanya sendiri.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_human_agent',
      description: 'Wajib digunakan ketika pengguna meminta berbicara dengan admin, operator, CS, atau manusia sejati secara eksplisit (misal: "bisa bicara dengan admin?", "saya mau komplain ke manusia"). Tool ini akan membisukan bot dan meneruskan percakapan ke tim Customer Service.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  }
];

const EXTERNAL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_stores',
      description: 'Mencari daftar toko berdasarkan kata kunci (nama atau kode toko). Wajib digunakan saat pengguna menyebutkan nama toko tetapi belum memberikan kode customernya, atau saat pengguna ingin mencari/mengecek data toko (meskipun inputnya berupa angka pasti seperti "0322").',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Kata kunci pencarian toko, bisa berupa nama toko, nomor toko, atau ID pelanggan. (Contoh: "0322", "Toko Makmur", dll).',
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',

    function: {
      name: 'search_product_price',
      description: 'Mencari harga barang (price list). WAJIB LANGSUNG DIPANGGIL TANPA BERTANYA LOKASI. SAAT MENJAWAB HASILNYA: Buatlah kalimat natural. DILARANG KERAS mengarang/mengubah nama barang, dan DILARANG KERAS menebak satuan barang (misal: menebak "per kilogram" hanya karena ada tulisan "KG" di nama barang). ANDA WAJIB SEBUTKAN HARGA MENGGUNAKAN SATUAN (UOM) ASLI DARI JSON (UOM1_Terbesar, UOM2_Menengah, UOM3_Terkecil). Ganti singkatan "CTN" menjadi "Karton", dan "PCK" menjadi "Pack", sisanya biarkan sesuai asli (seperti "PCS", "SAK", "BKS", dll). TAMPILKAN SEMUA varian barang dari tool ini tanpa dipotong. Contoh: "1. [Nama_Barang]: Rp 81.585 per PCS (isi 1 pcs), atau Rp 163.170 per SAK". Sesuaikan dengan UOM dan harga asli dari data.',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Kata kunci pencarian, seperti nama barang atau brand/merek (contoh: "pop ice" atau "merries").',
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_promo',
      description: 'Mencari promo atau paket hemat yang sedang berlaku (misal promo enesis, diskon pop ice). Gunakan ini jika pelanggan menanyakan "apakah ada promo" atau "ada diskon apa bulan ini". DILARANG KERAS berhalusinasi atau menebak jenis produk pada promo (misalnya menebak sabun/shampoo padahal di deskripsi data tidak ada). Jawab HANYA berdasarkan judul dan deskripsi yang persis dikembalikan oleh tool ini. JANGAN menebak isi gambar.',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Kata kunci promo (contoh: "enesis", "kispray", "all", "semua").',
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_human_agent',
      description: 'Wajib digunakan ketika pengguna meminta berbicara dengan admin, operator, CS, atau manusia sejati secara eksplisit (misal: "bisa bicara dengan admin?", "saya mau komplain ke manusia"). Tool ini akan membisukan bot dan meneruskan percakapan ke tim Customer Service.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tool_mute_spammer',
      description: 'Picu (call) tool ini JIKA DAN HANYA JIKA lawan bicara terus-menerus memaksa, spamming jualan, atau menawarkan produk berulang kali untuk yang KEDUA kalinya atau lebih (meskipun sudah ditolak). Ini akan memblokir pengguna secara diam-diam (silent drop).',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Alasan membisukan spammer.',
          }
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_daily_deliveries',
      description: 'Digunakan ketika sopir atau pengguna ingin mengecek/mencari data pengiriman atau faktur berdasarkan nomor pengiriman atau nomor invoice (NOPFI). Parameter yang dimasukkan bisa sebagian atau seluruh NOPFI.',
      parameters: {
        type: 'object',
        properties: {
          nopfi: {
            type: 'string',
            description: 'Sebagian atau seluruh Nomor Pengiriman atau Nomor Invoice (Contoh: "GI10126" atau "0824116").',
          },
        },
        required: ['nopfi'],
      },
    },
  },
  ...orderTools
];

module.exports = {
  INTERNAL_TOOLS,
  EXTERNAL_TOOLS
};
