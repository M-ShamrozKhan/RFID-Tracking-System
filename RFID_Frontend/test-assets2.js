import axios from 'axios';

async function test() {
    try {
        const res = await axios.get('http://localhost:5000/api/Asset/validate/LPT-1003');
        console.log("Success!");
    } catch(err) {
        console.log("Error:", err.response ? err.response.status : err.message);
    }
}
test();
