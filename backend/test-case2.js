const axios = require('axios');
const url = 'https://onetalk-api.taptalk.io/api/visitor/v1/webhook/chatbot/custom/2178/2619482363';

async function run(cid) {
    try {
        const payload = {
            caseID: cid,
            phone: '628111101625',
            eventType: 'messages',
            messages: [{ type: 'text', text: { body: 'test' } }]
        };
        const res = await axios.post(url, payload, { headers: { 'Secret-Key': 'K3bn7EFYgn6uJkNrxO3HqFTn01RI0RUG' } });
        console.log(`SUCCESS for cid '${cid}':`, res.data);
    } catch (e) {
        console.log(`FAILED for cid '${cid}':`, e.response ? e.response.data : e.message);
    }
}
run("");
run(null);
run("0");
