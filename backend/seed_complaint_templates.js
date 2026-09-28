/**
 * seed_complaint_templates.js
 * Script untuk menambahkan Prompt Templates analisa komplain percakapan TapTalk/OneTalk
 * Jalankan: node backend/seed_complaint_templates.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COMPLAINT_TEMPLATES = [
  {
    category: 'Analisa Komplain Percakapan',
    title: 'Analisa Komplain Cicilan / AR Dispute',
    type: 'FORM',
    templateText: `Analisa percakapan di device {device} dalam {days} hari terakhir. Cari pesan yang mengandung komplain customer yang tidak mengakui cicilan atau piutang (AR dispute) — misalnya kata: "tidak punya utang", "tidak ada cicilan", "kenapa ditagih", "tidak merasa punya piutang". Untuk setiap customer yang ditemukan komplain: (1) cari kode toko (kdcust) dan nama toko (nmcust) di tabel customers berdasarkan nomor HP pengirim, jika tidak ada di contacts cari di tabel customers; (2) cek apakah ada data piutang aktif (balance > 0) di tabel outstandingar yang menyebabkan sistem mengirimkan notifikasi tagihan.`,
    formFields: JSON.stringify([
      {
        name: 'device',
        label: 'Pilih Device / Akun TapTalk',
        type: 'device_lookup',
        placeholder: ''
      },
      {
        name: 'days',
        label: 'Rentang Waktu',
        type: 'select',
        options: [
          { value: '1', label: '1 Hari Terakhir' },
          { value: '3', label: '3 Hari Terakhir' },
          { value: '7', label: '7 Hari Terakhir' },
          { value: '14', label: '14 Hari Terakhir' },
          { value: '30', label: '30 Hari Terakhir' }
        ]
      }
    ])
  },
  {
    category: 'Analisa Komplain Percakapan',
    title: 'Analisa Komplain Barang Tidak Diterima / GR Dispute',
    type: 'FORM',
    templateText: `Analisa percakapan di device {device} dalam {days} hari terakhir. Cari pesan yang mengandung komplain toko menyatakan tidak menerima barang padahal mendapat notifikasi kiriman sudah diterima (GR dispute) — cari kata: "tidak terima", "belum terima", "barang tidak sampai", "tidak menerima barang", "belum sampai". Untuk setiap toko yang ditemukan: (1) identifikasi kode toko (kdcust) dan nama toko (nmcust) dari tabel customers menggunakan nomor HP pengirim; (2) cek faktur terkait di tabel outstandingar pada periode ±30 hari dari tanggal komplain untuk mengetahui apakah ada DO yang tercatat di sistem.`,
    formFields: JSON.stringify([
      {
        name: 'device',
        label: 'Pilih Device / Akun TapTalk',
        type: 'device_lookup',
        placeholder: ''
      },
      {
        name: 'days',
        label: 'Rentang Waktu',
        type: 'select',
        options: [
          { value: '1', label: '1 Hari Terakhir' },
          { value: '3', label: '3 Hari Terakhir' },
          { value: '7', label: '7 Hari Terakhir' },
          { value: '14', label: '14 Hari Terakhir' },
          { value: '30', label: '30 Hari Terakhir' }
        ]
      }
    ])
  },
  {
    category: 'Analisa Komplain Percakapan',
    title: 'Cek Identitas & Piutang Customer dari Nomor HP',
    type: 'FORM',
    templateText: `Cek data customer dengan nomor HP {phone}. Lakukan langkah berikut: (1) Cari di tabel contacts menggunakan phone_number dan real_phone_number (ILIKE); (2) Jika tidak ditemukan atau kode_customer kosong, cari di tabel customers menggunakan kolom phone dengan ILIKE — nomor bisa format 08xx atau 628xx; (3) Tampilkan kdcust, nmcust, alamat jika ada; (4) Cek apakah customer ini memiliki piutang aktif di tabel outstandingar (balance > 0). Tampilkan semua faktur yang belum lunas.`,
    formFields: JSON.stringify([
      {
        name: 'phone',
        label: 'Nomor HP Customer',
        type: 'text',
        placeholder: 'Contoh: 08123456789 atau 628123456789'
      }
    ])
  }
];

async function seedComplaintTemplates() {
  console.log('Seeding complaint prompt templates...\n');

  for (const template of COMPLAINT_TEMPLATES) {
    try {
      const existing = await prisma.promptTemplate.findFirst({
        where: { title: template.title }
      });

      if (existing) {
        await prisma.promptTemplate.update({
          where: { id: existing.id },
          data: {
            category: template.category,
            type: template.type,
            templateText: template.templateText,
            formFields: template.formFields
          }
        });
        console.log(`UPDATED: "${template.title}"`);
      } else {
        await prisma.promptTemplate.create({
          data: {
            category: template.category,
            title: template.title,
            type: template.type,
            templateText: template.templateText,
            formFields: template.formFields
          }
        });
        console.log(`CREATED: "${template.title}"`);
      }
    } catch (err) {
      console.error(`ERROR on "${template.title}":`, err.message);
    }
  }

  console.log('\nDone seeding complaint templates!');
  await prisma.$disconnect();
}

seedComplaintTemplates().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
