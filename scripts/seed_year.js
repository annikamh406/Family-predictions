
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('Seeding 2026...');

    // Check if year exists
    const { data: existing } = await supabase.from('game_years').select('*').eq('year', 2026).single();

    if (!existing) {
        const { error } = await supabase.from('game_years').insert([
            { year: 2026, status: 'forecasting' }
        ]);
        if (error) console.error('Error inserting:', error);
        else console.log('2026 created in forecasting mode.');
    } else {
        console.log('2026 already exists:', existing);
    }
}

seed();
