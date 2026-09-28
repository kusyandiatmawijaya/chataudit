const axios = require('axios');
async function testSync() {
    let offset = 0;
    const limit = 2000;
    let hasMore = true;
    let sum = 0;
    let totalItems = 0;
    const auth = {username: 'gs', password: 'Padma23#@!'};

    while (hasMore) {
        console.log('fetching offset', offset);
        const url = `http://222.165.244.5/ords/padma/webapi/rasiopiutangpersales?offset=${offset}&limit=${limit}`;
        const res = await axios.get(url, { auth });
        const items = res.data.items || [];
        totalItems += items.length;
        
        for (let item of items) {
            if (item.divisi === 'ENESIS') {
                sum += item.jumlah_piutang || 0;
            }
        }
        
        hasMore = res.data.hasMore === true && items.length > 0;
        offset += limit;
    }
    console.log('Total items fetched:', totalItems);
    console.log('Sum ENESIS:', sum);
}
testSync();
