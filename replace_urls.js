const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('http://localhost:5000')) {
                content = content.replace(/http:\/\/localhost:5000/g, '');
                fs.writeFileSync(fullPath, content);
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

replaceInDir('c:/Users/Tesla Laptops/Downloads/RFID/RFID_Frontend/src');
console.log('Replacement complete.');
