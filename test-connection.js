const dns = require('dns');

const projectRef = 'opvnlwsxmukhhinpcbhz';
const dbHost = `db.${projectRef}.supabase.co`;
const apiHost = `${projectRef}.supabase.co`;

console.log(`1. Checking API Host: ${apiHost}...`);
dns.lookup(apiHost, (err, address) => {
    if (err) {
        console.log(`❌ API Host Lookup Failed (${err.code}). Internet might be down or ID is wrong.`);
    } else {
        console.log(`✅ API Host Found: ${address}`);
    }

    console.log(`\n2. Checking DB Host: ${dbHost}...`);
    dns.lookup(dbHost, (err, address) => {
        if (err) {
            console.error(`❌ DB Host Lookup Failed (${err.code}).`);
            console.log('   -> If API worked but DB failed, the project is likely PAUSED.');
            console.log('   -> Go to Supabase Dashboard > Project > General to check status.');
        } else {
            console.log(`✅ DB Host Found: ${address}`);
        }
    });
});
