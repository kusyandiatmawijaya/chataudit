/**
 * Formats the raw JSON string from executeGetOutstandingAr into a readable WhatsApp message.
 * @param {string} rawJsonString JSON string returned by executeGetOutstandingAr
 * @returns {string} Formatted WhatsApp message
 */
function formatOutstandingAR(rawJsonString) {
  try {
    const data = JSON.parse(rawJsonString);

    if (data.found === false || !data.Data_Ditemukan) {
      return data.message || data.error || "Data Outstanding AR tidak ditemukan.";
    }

    let msg = `*Kode Toko:* ${data.Kode_Customer}\n*Nama Toko:* ${data.Nama_Customer}\n*Data Piutang:*\n\n`;
    
    // Formatting currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
    };

    // Ringkasan Piutang
    const ringkasan = data.Ringkasan_Piutang || {};
    msg += `*Ringkasan:*\n`;
    msg += `🧾 Total Faktur: ${ringkasan.Total_Faktur || 0}\n`;
    msg += `💰 Total Tagihan: ${formatCurrency(ringkasan.Total_Nominal_Tagihan || 0)}\n`;
    msg += `✅ Sudah Dibayar: ${formatCurrency(ringkasan.Total_Sudah_Dibayar || 0)}\n`;
    msg += `⚠️ Sisa Saldo: ${formatCurrency(ringkasan.Total_Sisa_Saldo || 0)}\n\n`;

    // Daftar Faktur
    if (data.Daftar_Faktur && data.Daftar_Faktur.length > 0) {
      msg += `*Daftar Faktur:*\n`;
      data.Daftar_Faktur.forEach((faktur, index) => {
        msg += `*${index + 1}. Faktur ${faktur.Nomor_Faktur}*\n`;
        msg += `🗓️ Tgl: ${faktur.Tanggal_Faktur || '-'}\n`;
        msg += `⚠️ Sisa: ${formatCurrency(faktur.Sisa_Tagihan || 0)}\n`;
        msg += `⏳ Jatuh Tempo: ${faktur.Tanggal_Jatuh_Tempo || '-'}\n\n`;
      });
    }

    return msg;
  } catch (error) {
    console.error("Error formatting AR Data:", error);
    return "Maaf, terjadi kesalahan saat memformat data piutang.";
  }
}

module.exports = {
  formatOutstandingAR,
};
