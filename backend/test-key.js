const axios = require('axios');
const url = 'https://onetalk-api.taptalk.io/api/visitor/v1/webhook/chatbot/custom/2178/2619482363';
const payload = {
    caseID: '2A7852BC5F',
    eventType: 'messages',
    messages: [{ type: 'text', text: { body: 'test' } }]
};

async function testKey(key) {
    try {
        await axios.post(url, payload, { headers: { 'Secret-Key': key } });
        console.log(`SUCCESS for key: ${key}`);
    } catch (e) {
        console.log(`FAILED for key: ${key} - ${e.response ? e.response.data : e.message}`);
    }
}

async function run() {
    await testKey('K3bn7EFYgn6uJkNrxO3HqFTn01Rl0RUG'); // lowercase L
    await testKey('K3bn7EFYgn6uJkNrxO3HqFTn01RI0RUG'); // uppercase I
    await testKey('K3bn7EFYgn6uJkNrxO3HqFTn01R10RUG'); // number 1
}
run();
