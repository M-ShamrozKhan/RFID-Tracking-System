import axios from 'axios';

async function test() {
    try {
        const res = await axios.get('http://localhost:5000/api/Asset');
        const assets = res.data;
        for (const a of assets) {
            try {
                const inner = await axios.get(`http://localhost:5000/api/Asset/validate/${a.assetId}`);
                console.log(`[SUCCESS] ${a.assetId}`);
            } catch(e) {
                console.log(`[FAILED] ${a.assetId} - ${e.response ? e.response.status : e.message}`);
            }
        }
    } catch(err) {
        console.log("Error:", err.message);
    }
}
test();
