const axios = require('axios');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { getTelegramBot } = require('../telegram');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function fetchMonthlyTargets() {
    try {
        const auth = process.env.APEX_API_USERNAME && process.env.APEX_API_PASSWORD ? {
            username: process.env.APEX_API_USERNAME,
            password: process.env.APEX_API_PASSWORD
        } : undefined;

        const response = await axios.get(`${process.env.APEX_API_URL || 'http://222.165.244.5/ords/padma/webapi'}/salesman/reports/listmonthlytarget`, {
            auth
        });
        if (response.data && Array.isArray(response.data.items)) {
            return response.data.items;
        } else if (Array.isArray(response.data)) {
            return response.data;
        }
        return [];
    } catch (error) {
        console.error('[SalesmanReport] Failed to fetch monthly targets:', error.message);
        return [];
    }
}

async function fetchTargetDetails(linkall) {
    const allItems = [];
    let offset = 0;
    const limit = 25;
    let hasMore = true;

    try {
        const auth = process.env.APEX_API_USERNAME && process.env.APEX_API_PASSWORD ? {
            username: process.env.APEX_API_USERNAME,
            password: process.env.APEX_API_PASSWORD
        } : undefined;

        while (hasMore) {
            const response = await axios.get(`${process.env.APEX_API_URL || 'http://222.165.244.5/ords/padma/webapi'}/salesman/reports/targetmonthlyrunning`, {
                params: {
                    P299_LINKALL: linkall,
                    P299_KET: 'TARGET PER HARI',
                    offset: offset
                },
                auth
            });

            if (response.data && Array.isArray(response.data.items)) {
                allItems.push(...response.data.items);
                hasMore = response.data.hasMore;
                offset += limit;
            } else {
                hasMore = false;
            }
        }
    } catch (error) {
        console.error(`[SalesmanReport] Failed to fetch details for linkall ${linkall}:`, error.message);
    }

    return allItems;
}

function formatCurrency(num) {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);
}

async function generateReportPdf(summary, details, filepath) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    let totalTarget = 0;
    let totalRealisasi = 0;
    let totalGap = 0;
    let totalEC = 0;
    let totalPiutangSales = 0;
    let totalPiutangAll = 0;
    let totalAvgSales = 0;

    // Urutkan berdasarkan field 'u'
    details.sort((a, b) => (a.u || 0) - (b.u || 0));

    let currentHeaderKey = '';
    let tableRows = '';

    details.forEach((item, index) => {
        totalTarget += item.target_omzet || 0;
        totalRealisasi += item.actual_omzet || 0;
        totalGap += item.gap_omzet || 0;
        if (item.ec && item.ec !== '-') totalEC++;
        totalPiutangSales += item.ost_ar_sls || item.piutang_sales || 0;
        totalPiutangAll += item.ost_ar_all || item.total_piutang || 0;
        totalAvgSales += item.avg_palsu || 0;

        const headerKey = `${item.nama}_${item.rute}`;
        if (headerKey !== currentHeaderKey) {
            currentHeaderKey = headerKey;
            tableRows += `
            <tr style="background-color: #F8FAFC; border-top: 2px solid #E2E8F0; border-bottom: 2px solid #E2E8F0;">
                <td colspan="9" style="padding: 10px 16px;">
                    <div style="font-weight: 700; color: #0F172A; font-size: 11px; display: flex; gap: 24px;">
                        <span>👤 NAMA: ${item.nama || '-'}</span>
                        <span>📍 RUTE: ${item.rute || '-'}</span>
                    </div>
                </td>
            </tr>
            `;
        }

        tableRows += `
        <tr>
            <td style="text-align: center;">${index + 1}</td>
            <td>
                <div style="font-weight: 700; color: #111827;">${item.nmcust || item.nama_outlet || '-'}</div>
                <div style="font-size: 11px; color: #6B7280; margin-top: 2px;">${item.kdcust || item.kd_outlet || '-'}</div>
            </td>
            <td style="text-align: center;">
                ${item.ec && item.ec !== '-' ? '<span style="background-color: #6EE7B7; color: #064E3B; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">EC</span>' : '<span style="background-color: #EEF2FF; color: #9CA3AF; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">-</span>'}
            </td>
            <td style="font-weight: 600; color: #4B5563;">${formatCurrency(item.avg_palsu)}</td>
            <td style="font-weight: 600;">${formatCurrency(item.target_omzet)}</td>
            <td style="${item.actual_omzet > 0 ? 'color: #10B981; font-weight: 700;' : 'color: #6B7280; text-align: center;'}">${item.actual_omzet ? formatCurrency(item.actual_omzet) : '-'}</td>
            <td style="${item.gap_omzet < 0 ? 'color: #EF4444; font-weight: 600;' : 'color: #10B981; font-weight: 600;'}">${formatCurrency(item.gap_omzet)}</td>
            <td>${(item.ost_ar_sls || item.piutang_sales) ? formatCurrency(item.ost_ar_sls || item.piutang_sales) : '-'}</td>
            <td>${(item.ost_ar_all || item.total_piutang) ? formatCurrency(item.ost_ar_all || item.total_piutang) : '-'}</td>
        </tr>
        `;
    });

    // Computed variables for Bagian A
    const percentOmzet = summary.target_omzet ? ((summary.actual_omzet / summary.target_omzet) * 100) : 0;
    const defisitPercent = Math.max(0, 100 - percentOmzet);
    const totalHariKerjaBulan = summary.target_per_hari ? Math.round(summary.target_omzet / summary.target_per_hari) : 26;
    const sisaHariKerja = Math.max(0, totalHariKerjaBulan - (summary.actual_hari_kerja || 0));
    const realisasiRataRata = summary.actual_hari_kerja ? (summary.actual_omzet / summary.actual_hari_kerja) : 0;
    const defisitRataRata = summary.target_per_hari - realisasiRataRata;
    const targetDiperlukanSisa = sisaHariKerja > 0 ? ((summary.target_omzet - summary.actual_omzet) / sisaHariKerja) : 0;
    const initials = summary.nama_sales ? summary.nama_sales.substring(0, 2).toUpperCase() : 'NA';
    const percentKehadiran = summary.total_hari_kerja ? ((summary.actual_hari_kerja / summary.total_hari_kerja) * 100).toFixed(0) : 100;

    // Formatting helpers
    const formatJt = (num) => num ? (num / 1000000).toFixed(2).replace('.', ',') + ' Jt' : '0 Jt';

    const fullHtml = `
    <!DOCTYPE html>
    <html lang="id">
        <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            
            :root {
                --primary: #0F172A;
                --primary-light: #F1F5F9;
                --success: #10B981;
                --success-light: #D1FAE5;
                --danger: #EF4444;
                --danger-light: #FEE2E2;
                --warning: #F59E0B;
                --warning-light: #FEF3C7;
                --text-main: #0F172A;
                --text-muted: #64748B;
                --bg-body: #F8FAFC;
                --bg-card: #FFFFFF;
                --border: #E2E8F0;
            }

            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: 'Inter', sans-serif;
                background-color: var(--bg-body);
                color: var(--text-main);
                padding: 20px 30px;
                line-height: 1.5;
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
            }

            /* Utilities */
            .flex { display: flex; }
            .flex-col { display: flex; flex-direction: column; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .gap-2 { gap: 8px; }
            .gap-4 { gap: 16px; }
            .w-full { width: 100%; }
            
            .text-xs { font-size: 10px; }
            .text-sm { font-size: 11px; }
            .text-base { font-size: 12px; }
            .text-lg { font-size: 14px; }
            .text-xl { font-size: 18px; }
            .text-2xl { font-size: 22px; }
            
            .font-semibold { font-weight: 600; }
            .font-bold { font-weight: 700; }
            .font-extrabold { font-weight: 800; }

            .text-muted { color: var(--text-muted); }
            .text-success { color: var(--success); }
            .text-danger { color: var(--danger); }
            .text-primary { color: var(--primary); }
            .text-white { color: #FFFFFF; }

            .bg-white { background-color: #FFFFFF; }
            .bg-primary { background-color: var(--primary); }
            .bg-success-light { background-color: var(--success-light); }
            .bg-danger-light { background-color: var(--danger-light); }
            .bg-gray-100 { background-color: #F1F5F9; }
            .bg-gray-50 { background-color: #F8FAFC; }
            .bg-blue-50 { background-color: #EFF6FF; }

            .rounded-lg { border-radius: 8px; }
            .rounded-full { border-radius: 9999px; }
            .border { border: 1px solid var(--border); }
            .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
            
            .p-4 { padding: 16px; }
            .p-3 { padding: 12px; }
            .px-3 { padding-left: 12px; padding-right: 12px; }
            .py-1 { padding-top: 4px; padding-bottom: 4px; }
            .mb-4 { margin-bottom: 16px; }
            .mt-4 { margin-top: 16px; }

            /* Badge */
            .badge {
                display: inline-flex;
                align-items: center;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 700;
            }

            /* Dashboard Grid */
            .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
            .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }

            /* specific styling for progress bar */
            .progress-bar {
                height: 24px;
                width: 100%;
                background-color: #DBEAFE;
                border-radius: 4px;
                overflow: hidden;
                display: flex;
            }
            .progress-fill {
                height: 100%;
                background-color: #000000;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 10px;
                font-weight: 700;
            }

            /* Section Label */
            .section-label {
                font-size: 9px;
                font-weight: 700;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* AR Table */
            .ar-row {
                display: flex;
                justify-content: space-between;
                padding: 10px 16px;
                margin-bottom: 8px;
                background-color: #F8FAFC;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
            }
            .ar-row.total {
                background-color: #F1F5F9;
                border: 1px solid #E2E8F0;
            }
            .ar-row.success {
                background-color: #D1FAE5;
                color: #065F46;
            }
            .ar-row.final {
                background-color: #000000;
                color: #FFFFFF;
            }

            /* Standard Table */
            table { width: 100%; border-collapse: collapse; background: var(--bg-card); }
            th, td { padding: 8px 12px; text-align: left; font-size: 10px; border-bottom: 1px solid var(--border); }
            th { background-color: #F8FAFC; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        </style>
        </head>
        <body>

        <!-- Header 1: Document Info -->
        <div class="bg-white border rounded-lg p-4 mb-4 shadow-sm flex justify-between items-center">
            <div class="flex items-center gap-4">
                <div class="bg-primary text-white rounded-lg flex items-center justify-center" style="width: 48px; height: 48px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                <div>
                    <div class="text-success font-bold text-xs" style="letter-spacing: 0.5px;">${summary.sales_adviser || 'FORISA DESSERT'}</div>
                    <div class="text-xl font-extrabold" style="margin-bottom: 2px;">LAPORAN REKAPAN SALESMAN</div>
                    <div class="text-muted text-xs">Dokumen Evaluasi Kinerja & Realisasi Distribusi Penjualan</div>
                </div>
            </div>
            <div class="flex-col items-end gap-2" style="text-align: right;">
                <div class="text-xs font-semibold">📅 Periode Berjalan: ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</div>
                <div class="text-xs text-muted">Siklus Kerja: ${summary.actual_hari_kerja || 0} / ${summary.total_hari_kerja || 0} Hari Aktif Terverifikasi</div>
                <div class="badge bg-blue-50 text-primary" style="margin-top: 4px;">STATUS: LAPORAN RESMI</div>
            </div>
        </div>

        <!-- Header 2: Salesman Info -->
        <div class="bg-gray-50 border rounded-lg p-4 mb-4 flex justify-between items-center">
            <div class="flex items-center gap-4">
                <div class="bg-primary text-white rounded-lg flex items-center justify-center font-bold text-xl relative" style="width: 48px; height: 48px;">
                    ${initials}
                    <div style="position: absolute; bottom: -4px; right: -4px; background: #10B981; border: 2px solid #F8FAFC; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                </div>
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <div class="text-lg font-bold">${summary.nama_sales || '-'}</div>
                        <div class="text-xs text-muted bg-gray-100 px-3 py-1 rounded-full font-semibold">KODE: ${summary.kdsls || '-'}</div>
                        <div class="text-xs bg-success-light text-success px-3 py-1 rounded-full font-bold">● KEHADIRAN ${percentKehadiran >= 100 ? 'SEMPURNA' : ''} ${percentKehadiran}%</div>
                    </div>
                    <div class="flex items-center gap-2 text-xs text-muted font-medium">
                        <div>🏢 Adviser: <span class="font-bold text-main">${summary.sales_adviser || '-'}</span></div>
                        <div>•</div>
                        <div>📍 Wilayah: <span class="font-bold text-main">${summary.area || '-'}</span></div>
                        <div>•</div>
                        <div>📅 Siklus: Bulan Berjalan (${summary.actual_hari_kerja || 0} / ${summary.total_hari_kerja || 0} Hari)</div>
                    </div>
                </div>
            </div>
            <div class="flex gap-4 bg-white p-3 rounded-lg border shadow-sm text-center">
                <div class="flex-col px-3 border-r" style="border-right: 1px solid var(--border);">
                    <div class="text-xs text-muted font-bold mb-1">TARGET KERJA</div>
                    <div class="text-base font-bold">${summary.total_hari_kerja || 0} Hari</div>
                </div>
                <div class="flex-col px-3 border-r" style="border-right: 1px solid var(--border);">
                    <div class="text-xs text-muted font-bold mb-1">KEHADIRAN ACTUAL</div>
                    <div class="text-base font-bold text-success">${summary.actual_hari_kerja || 0} Hari</div>
                </div>
                <div class="flex-col px-3">
                    <div class="text-xs text-muted font-bold mb-1">DISIPLIN JAM</div>
                    <div class="text-base font-bold">${summary.terlambat || 0} Terlambat</div>
                </div>
            </div>
        </div>

        <!-- KPI Cards -->
        <div class="grid-3 mb-4">
            <!-- Card 1: Omzet -->
            <div class="bg-white border rounded-lg p-4 shadow-sm flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center mb-3">
                        <div class="text-xs font-bold text-muted flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle></svg>
                            OMZET PENJUALAN
                        </div>
                        <div class="badge ${percentOmzet >= 100 ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}">
                            ${percentOmzet >= 100 ? '↗' : '↘'} ${percentOmzet.toFixed(2)}%
                        </div>
                    </div>
                    <div class="text-xs text-muted font-semibold">REALISASI AKTUAL</div>
                    <div class="text-2xl font-extrabold text-main mb-2">${formatCurrency(summary.actual_omzet)}</div>
                    <div class="flex justify-between text-xs font-semibold">
                        <span class="text-muted">Target: ${formatCurrency(summary.target_omzet)}</span>
                        <span class="${summary.gap_omzet < 0 ? 'text-danger' : 'text-success'}">Gap: ${formatCurrency(summary.gap_omzet)}</span>
                    </div>
                </div>
                <div style="border-top: 1px dashed var(--border); margin: 12px 0;"></div>
                <div class="flex justify-between items-center text-xs font-semibold">
                    <div>
                        <div class="text-muted flex items-center gap-1 mb-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> Run-rate Harian:
                        </div>
                        <div class="text-muted">${formatCurrency(summary.target_per_hari)}</div>
                    </div>
                    <div class="bg-white border rounded-lg p-2" style="width: 140px;">
                        <div style="font-size: 8px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 2px; line-height: 1.2;">TARGET DIPERLUKAN/HARI SISA</div>
                        <div style="font-size: 10px; font-weight: 700; color: #EF4444; margin-bottom: 1px;">${formatCurrency(targetDiperlukanSisa)}</div>
                        <div style="font-size: 8px; color: #64748B;">Untuk Capai Target</div>
                    </div>
                </div>
            </div>

            <!-- Card 2: AR -->
            <div class="bg-white border rounded-lg p-4 shadow-sm flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center mb-3">
                        <div class="text-xs font-bold text-muted flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            AR COLLECTION
                        </div>
                        <div class="badge bg-blue-50 text-primary">
                            ⇄ ${summary.p_ar ? Number(summary.p_ar).toFixed(2) : 0}%
                        </div>
                    </div>
                    <div class="text-xs text-muted font-semibold">PIUTANG TERTAGIH (COLLECTED)</div>
                    <div class="text-2xl font-extrabold text-success mb-2">${formatCurrency(summary.piutang_tertagih)}</div>
                    <div class="flex justify-between text-xs font-semibold">
                        <span class="text-muted">Total Tagihan: ${formatCurrency(summary.total_piutang)}</span>
                        <span class="text-muted">Sisa: ${formatCurrency(summary.saldo_akhir)}</span>
                    </div>
                </div>
                <div style="border-top: 1px dashed var(--border); margin: 12px 0;"></div>
                <div class="flex justify-between items-center text-xs font-semibold">
                    <span class="text-muted">Piutang Baru: ${formatCurrency(summary.piutang_bulan_ini)}</span>
                    <span class="text-success">${summary.p_ar ? Number(summary.p_ar).toFixed(1) : 0}% SELESAI</span>
                </div>
            </div>

            <!-- Card 3: Outlet -->
            <div class="bg-white border rounded-lg p-4 shadow-sm flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center mb-3">
                        <div class="text-xs font-bold text-muted flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            CAKUPAN OUTLET & KUNJUNGAN
                        </div>
                        <div class="badge bg-success-light text-success">
                            ✓ ${summary.p_check_in_out ? Number(summary.p_check_in_out).toFixed(0) : 0}% Visit
                        </div>
                    </div>
                    <div class="text-xs text-muted font-semibold">OUTLET ACTIVE (OA) VS RO 3 BULAN</div>
                    <div class="flex justify-between items-end mb-2">
                        <div class="text-2xl font-extrabold text-main">${summary.actual_oa || 0} <span class="text-base text-muted font-semibold">/ ${summary.ro_3_bulan || 0} Toko</span></div>
                        <div class="text-sm font-bold text-main">${summary.p_oa ? Number(summary.p_oa).toFixed(2) : 0}%</div>
                    </div>
                    <div class="flex justify-between text-xs font-semibold">
                        <span class="text-muted">CB: ${summary.cb || 0} Toko</span>
                        <span class="${summary.gap_oa < 0 ? 'text-danger' : 'text-success'}">Gap OA: ${summary.gap_oa || 0} Toko</span>
                    </div>
                </div>
                <div style="border-top: 1px dashed var(--border); margin: 12px 0;"></div>
                <div class="flex justify-between items-center text-xs font-semibold">
                    <span class="text-muted">${summary.actual_check_in_out || 0} / ${summary.total_kunjungan_wajib || 0} Kunjungan Selesai</span>
                    <span class="text-main">EC: ${summary.actual_ec || 0} TOKO (${summary.actual_oa ? ((summary.actual_ec / summary.actual_oa) * 100).toFixed(0) : 0}% OA)</span>
                </div>
            </div>
        </div>

        <!-- Sisa Hari Kerja Status Bar -->
        <div class="bg-blue-50 text-primary p-3 rounded-lg flex justify-between items-center mb-4">
            <div class="text-xs font-semibold flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Sisa Hari Kerja Bulan Ini: <span class="font-bold text-main">${sisaHariKerja} Hari Kerja</span>
            </div>
            <div class="badge bg-white border text-primary">STATUS: RUNNING</div>
        </div>

        <!-- Details Table Section (Bagian D) -->
        <div style="margin-top: 32px; margin-bottom: 8px;">
            <div style="font-size: 10px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">BAGIAN D • TARGET & REALISASI PER OUTLET (RUTE: ${summary.rute || 'HARI INI'})</div>
            <div class="flex-between" style="align-items: center; margin-top: 4px;">
                <div>
                    <h2 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0;">Daftar Kunjungan & Piutang Outlet</h2>
                    <p style="font-size: 12px; color: #6B7280; margin: 4px 0 0 0;">Daftar ${details.length} outlet kunjungan rute ${summary.rute || 'Hari Ini'} beserta target omzet, realisasi, gap, status EC, dan outstanding piutang (AR).</p>
                </div>
                <div style="background-color: #EEF2FF; color: #3730A3; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700;">
                    ${details.length} KUNJUNGAN TERJADWAL
                </div>
            </div>
        </div>

        <table style="border: none; box-shadow: none;">
            <thead>
            <tr style="background-color: #F1F5F9; border-bottom: none;">
                <th style="width: 40px; text-align: center; border: none; font-size: 10px;">NO</th>
                <th style="border: none; font-size: 10px;">KODE & NAMA OUTLET</th>
                <th style="text-align: center; border: none; font-size: 10px;">STATUS EC</th>
                <th style="border: none; font-size: 10px;">AVG SALES</th>
                <th style="border: none; font-size: 10px;">TARGET OMZET</th>
                <th style="border: none; font-size: 10px;">REALISASI</th>
                <th style="border: none; font-size: 10px;">GAP OMZET</th>
                <th style="border: none; font-size: 10px;">PIUTANG SALES</th>
                <th style="border: none; font-size: 10px;">TOTAL PIUTANG</th>
            </tr>
            </thead>
            <tbody>
            ${tableRows || '<tr><td colspan="9" style="text-align: center; color: #6B7280; padding: 20px;">Tidak ada data outlet</td></tr>'}
            <tr style="background-color: #EEF2FF; border-top: 2px solid #E2E8F0;">
                <td colspan="2" style="font-weight: 700; text-align: left; padding-left: 20px; color: #111827; font-size: 11px;">TOTAL RUTE ${summary.rute ? summary.rute.toUpperCase() : 'HARI INI'}</td>
                <td style="text-align: center;"><span style="background-color: #6EE7B7; color: #064E3B; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">${totalEC} EC</span></td>
                <td style="font-weight: 700; color: #4B5563; font-size: 11px;">${formatCurrency(totalAvgSales)}</td>
                <td style="font-weight: 700; color: #111827; font-size: 11px;">${formatCurrency(totalTarget)}</td>
                <td style="font-weight: 700; color: #10B981; font-size: 11px;">${formatCurrency(totalRealisasi)}</td>
                <td style="font-weight: 700; color: #EF4444; font-size: 11px;">${formatCurrency(totalGap)}</td>
                <td style="font-weight: 700; color: #111827; font-size: 11px;">${formatCurrency(totalPiutangSales)}</td>
                <td style="font-weight: 700; color: #111827; font-size: 11px;">${formatCurrency(totalPiutangAll)}</td>
            </tr>
            </tbody>
        </table>
        
        <!-- Summary Footer Card -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
            <div style="display: flex; gap: 16px; color: #6B7280; flex-wrap: wrap;">
                <div>Target: <span style="font-weight: 700; color: #111827;">${formatCurrency(totalTarget)}</span></div>
                <div>•</div>
                <div>Realisasi: <span style="font-weight: 700; color: #10B981;">${formatCurrency(totalRealisasi)} (${totalTarget ? ((totalRealisasi / totalTarget) * 100).toFixed(2) : 0}%)</span></div>
                <div>•</div>
                <div>AR Salesman: <span style="font-weight: 700; color: #111827;">${formatCurrency(totalPiutangSales)}</span></div>
                <div>•</div>
                <div>AR Keseluruhan: <span style="font-weight: 700; color: #111827;">${formatCurrency(totalPiutangAll)}</span></div>
            </div>
            <div style="background-color: #EEF2FF; color: #4F46E5; padding: 4px 10px; border-radius: 4px; font-weight: 700;">
                AUDIT RUTE BERJALAN
            </div>
        </div>

        </body>
    </html>
    `;

    await page.setContent(fullHtml, { waitUntil: 'load' });
    await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    await browser.close();
}

async function runSalesmanReportJob(senderSessionId) {
    console.log(`[SalesmanReport] Starting monthly report job using bot: ${senderSessionId || 'telegram-main'}`);

    const targets = await fetchMonthlyTargets();
    if (!targets || targets.length === 0) {
        console.log('[SalesmanReport] No targets found to process.');
        return;
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const bot = getTelegramBot(senderSessionId || 'telegram-main');
    if (!bot) {
        console.error(`[SalesmanReport] Telegram bot ${senderSessionId || 'telegram-main'} not found! Cannot send reports.`);
        return;
    }

    for (const summary of targets) {
        if (!summary.chat_id || !summary.linkall) {
            console.log(`[SalesmanReport] Skipping ${summary.nama_sales} due to missing chat_id or linkall.`);
            continue;
        }

        try {
            console.log(`[SalesmanReport] Processing report for ${summary.nama_sales} (chat_id: ${summary.chat_id})`);
            const details = await fetchTargetDetails(summary.linkall);

            const timestamp = Date.now();
            const filename = `Report_${summary.kdsls}_${timestamp}.pdf`;
            const filepath = path.join(UPLOADS_DIR, filename);

            await generateReportPdf(summary, details, filepath);

            const isPhoneNumber = /^(08|62|\+62)\d+$/.test(summary.chat_id.toString());

            if (isPhoneNumber) {
                console.log(`[SalesmanReport] chat_id ${summary.chat_id} is a phone number. Falling back to WhatsApp.`);
                const { sendWhatsAppDocument } = require('./taptalk.service');
                const baseUrl = process.env.BASE_URL || 'https://auditwa.padmasaripangan.co.id';
                const fileUrl = `${baseUrl}/uploads/${filename}`;

                await sendWhatsAppDocument(summary.chat_id, fileUrl, filename, `Laporan Rekapan Salesman: ${summary.nama_sales}\nTarget Omzet: ${formatCurrency(summary.target_omzet)}\nActual Omzet: ${formatCurrency(summary.actual_omzet)}`);
                console.log(`[SalesmanReport] Successfully sent report via WhatsApp to ${summary.nama_sales} (phone: ${summary.chat_id})`);
            } else {
                await bot.sendDocument(summary.chat_id, filepath, {
                    caption: `Laporan Rekapan Salesman: ${summary.nama_sales}\nTarget Omzet: ${formatCurrency(summary.target_omzet)}\nActual Omzet: ${formatCurrency(summary.actual_omzet)}`
                });
                console.log(`[SalesmanReport] Successfully sent report via Telegram to ${summary.nama_sales} (chat_id: ${summary.chat_id})`);
            }

        } catch (error) {
            if (error.code === 'ETELEGRAM') {
                console.error(`[SalesmanReport] Failed to send report to ${summary.nama_sales} (chat_id: ${summary.chat_id}): Telegram Error - ${error.response?.body?.description || error.message}`);
            } else {
                console.error(`[SalesmanReport] Failed to process report for ${summary.nama_sales}:`, error.message);
            }
        }
    }

    console.log('[SalesmanReport] Finished monthly report job.');
}

async function generatePreviewReport() {
    console.log('[SalesmanReport] Generating preview report...');

    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const targets = await fetchMonthlyTargets();
    if (!targets || targets.length === 0) {
        throw new Error('No targets found to generate preview.');
    }

    // Just pick the first one for preview
    const summary = targets[0];
    if (!summary.linkall) {
        throw new Error('First target missing linkall.');
    }

    const details = await fetchTargetDetails(summary.linkall);
    const filename = `Preview_${summary.kdsls}_${Date.now()}.pdf`;
    const filepath = path.join(UPLOADS_DIR, filename);

    await generateReportPdf(summary, details, filepath);

    return filepath;
}

module.exports = {
    runSalesmanReportJob,
    generatePreviewReport
};
