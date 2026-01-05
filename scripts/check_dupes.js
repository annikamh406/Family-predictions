
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from web/.env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDuplicates() {
    console.log("--- Checking Duplicate Users ---");
    const { data: users } = await supabase.from('users').select('*');
    const userMap = {};
    users.forEach(u => {
        if (!userMap[u.username]) userMap[u.username] = [];
        userMap[u.username].push(u.id);
    });

    Object.entries(userMap).forEach(([name, ids]) => {
        if (ids.length > 1) {
            console.log(`Duplicate User '${name}':`, ids);
        }
    });

    console.log("\n--- Checking Duplicate Predictions ---");
    const { data: predictions } = await supabase.from('predictions').select('*, user:users(username)');
    const predMap = {};

    predictions.forEach(p => {
        const key = `${p.user.username}-${p.year}-${p.category}`;
        if (!predMap[key]) predMap[key] = [];
        predMap[key].push(p.id);
    });

    Object.entries(predMap).forEach(([key, ids]) => {
        if (ids.length > 1) {
            console.log(`Duplicate Prediction '${key}':`, ids);
        }
    });
}

checkDuplicates();
