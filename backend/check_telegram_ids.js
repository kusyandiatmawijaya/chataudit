const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

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
        console.error('Failed to fetch monthly targets:', error.message);
        return [];
    }
}

async function checkIds() {
    console.log("Fetching API Targets...");
    const targets = await fetchMonthlyTargets();
    console.log(`Fetched ${targets.length} targets from API.`);

    console.log("Fetching Contacts from DB...");
    const contacts = await prisma.contact.findMany({
        where: { kodeSales: { not: null } }
    });
    console.log(`Fetched ${contacts.length} contacts with kodeSales from DB.`);

    const contactMap = {};
    for (const c of contacts) {
        if (!contactMap[c.kodeSales]) {
            contactMap[c.kodeSales] = [];
        }
        contactMap[c.kodeSales].push(c);
    }

    let mismatchCount = 0;
    let notFoundInDbCount = 0;
    
    console.log("\n=================================================");
    console.log("DISCREPANCY REPORT: API chat_id vs DB telegramId");
    console.log("=================================================");

    for (const target of targets) {
        if (!target.kdsls || !target.chat_id) continue;
        
        // Exclude phone numbers (WhatsApp fallback), since we are looking for telegram chat_id issues
        const isPhoneNumber = /^(08|62|\+62)\d+$/.test(target.chat_id.toString());
        if (isPhoneNumber) continue;

        const matchingContacts = contactMap[target.kdsls];

        if (!matchingContacts || matchingContacts.length === 0) {
            console.log(`[NOT IN DB] Sales: ${target.nama_sales} (Kode: ${target.kdsls})`);
            console.log(`   -> API chat_id: ${target.chat_id}`);
            console.log(`   -> No contact found in database with this kodeSales.`);
            notFoundInDbCount++;
        } else {
            // Check if any matching contact has a different telegramId
            let matchFound = false;
            let mismatches = [];
            for (const c of matchingContacts) {
                if (c.telegramId == target.chat_id) {
                    matchFound = true;
                    break;
                }
                mismatches.push(c.telegramId || 'null');
            }

            if (!matchFound) {
                console.log(`[MISMATCH] Sales: ${target.nama_sales} (Kode: ${target.kdsls})`);
                console.log(`   -> API chat_id: ${target.chat_id}`);
                console.log(`   -> DB telegramId(s): ${mismatches.join(', ')}`);
                console.log(`   -> DB Contact Name(s): ${matchingContacts.map(c => c.name).join(', ')}`);
                mismatchCount++;
            }
        }
    }

    console.log("\n=================================================");
    console.log(`Total Mismatches Found: ${mismatchCount}`);
    console.log(`Total Sales in API without DB Contact: ${notFoundInDbCount}`);
    console.log("=================================================\n");
}

checkIds().catch(console.error).finally(() => prisma.$disconnect());
