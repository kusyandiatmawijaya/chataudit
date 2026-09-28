const axios = require('axios');
require('dotenv').config();

async function test() {
    const auth = process.env.APEX_API_USERNAME && process.env.APEX_API_PASSWORD ? {
        username: process.env.APEX_API_USERNAME,
        password: process.env.APEX_API_PASSWORD
    } : undefined;

    const res = await axios.get(`${process.env.APEX_API_URL || 'http://222.165.244.5/ords/padma/webapi'}/salesman/reports/targetmonthlyrunning?P299_LINKALL=SALES.FBK205&P299_KET=TARGET%20OMZET&limit=1`, { auth });
    console.log(JSON.stringify(res.data.items[0], null, 2));
}
test();
