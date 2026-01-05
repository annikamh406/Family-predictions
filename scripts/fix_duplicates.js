
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixDuplicates() {
    console.log("--- Fixing Duplicate Predictions ---");
    const { data: predictions, error } = await supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false }); // Newest first

    if (error) {
        console.error("Error fetching predictions:", error);
        return;
    }

    const seen = new Set();
    const idsToDelete = [];

    for (const p of predictions) {
        const key = `${p.user_id}-${p.year}-${p.category}`;
        if (seen.has(key)) {
            // Already saw a newer version, so this is an older duplicate
            idsToDelete.push(p.id);
        } else {
            seen.add(key);
        }
    }

    if (idsToDelete.length > 0) {
        console.log(`Found ${idsToDelete.length} duplicates to delete.`);
        const { error: deleteError } = await supabase
            .from('predictions')
            .delete()
            .in('id', idsToDelete);

        if (deleteError) console.error("Error deleting:", deleteError);
        else console.log("✅ Successfully deleted duplicates.");
    } else {
        console.log("No duplicates found.");
    }

    console.log("\n--- Fixing Duplicate Users ---");
    const { data: users } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (users) {
        const seenUsers = new Set();
        const usersToDelete = [];

        for (const u of users) {
            // Normalized username check
            const name = u.username.trim().toLowerCase();
            if (seenUsers.has(name)) {
                usersToDelete.push(u.id);
            } else {
                seenUsers.add(name);
            }
        }

        if (usersToDelete.length > 0) {
            console.log(`Found ${usersToDelete.length} duplicate users to delete.`);
            // Deleting users likely deletes their bets/predictions via cascade if set up, 
            // but we just cleaned predictions so it should be fine.
            const { error: uErr } = await supabase.from('users').delete().in('id', usersToDelete);
            if (uErr) console.error("Error deleting users:", uErr);
            else console.log("✅ Successfully deleted duplicate users.");
        } else {
            console.log("No duplicate users found.");
        }
    }
}

fixDuplicates();
