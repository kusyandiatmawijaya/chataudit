const axios = require('axios');
const url = 'https://onetalk-api.taptalk.io/api/visitor/v1/webhook/chatbot/custom/2178/2619482363';
const payload = {
    caseID: '628111101625',
    eventType: 'messages',
    messages: [{ type: 'text', text: { body: 'test dummy caseId' } }]
};

async function run() {
    try {
        const res = await axios.post(url, payload, { headers: { 'Secret-Key': 'K3bn7EFYgn6uJkNrxO3HqFTn01RI0RUG' } });
        console.log(`SUCCESS:`, res.data);
    } catch (e) {
        console.log(`FAILED:`, e.response ? e.response.data : e.message);
    }
}
run();
