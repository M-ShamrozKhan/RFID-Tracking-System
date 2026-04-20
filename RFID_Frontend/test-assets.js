import axios from 'axios';

async function test() {
    try {
        const res = await axios.get('http://localhost:5000/api/Asset');
        console.log(JSON.stringify(res.data.map(a => ({ id: a.assetId, tag: a.rfidTagId })), null, 2));
    } catch(err) {
        console.log("Error:", err.message);
    }
}
test();
