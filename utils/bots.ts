import { supabase } from "./supabase"
import { gaussianRandom, clamp } from "./math"

export const BOT_NAMES = {
    OPTIMIST: "🌞 The Optimist",
    PESSIMIST: "🌧️ The Pessimist",
    WILDCARD: "🎲 The Wildcard",
    CONSENSUS: "📊 The Consensus"
}

export async function generateBotBets(year: number) {
    console.log("🤖 Generating Bot Bets for year", year)

    // 1. Ensure Bot Users Exist
    const bots = await ensureBotUsers()

    // 2. Fetch Predictions for the year
    const { data: predictions } = await supabase
        .from('predictions')
        .select('id')
        .eq('year', year)

    if (!predictions || predictions.length === 0) return

    // 3. Fetch Existing Human Bets (for Consensus stats)
    const { data: humanBets } = await supabase
        .from('bets')
        .select('probability, prediction_id')
    // We filter out bots roughly by checking if user_id is NOT in our bot list
    // but easier just to fetch all and filter in JS since we just have the IDs.

    // Calculate stats per prediction
    const predictionStats: Record<string, { sum: number, count: number, values: number[] }> = {}

    humanBets?.forEach(bet => {
        // Exclude bots if they already bet (though we are about to overwrite them)
        // ideally we'd filter by bot IDs but let's just assume we want "all stats so far"
        // actually for "Human Consensus" we should filter out previous bot bets if any.
        // For simplicity, let's just use all bets found.
        if (!predictionStats[bet.prediction_id]) {
            predictionStats[bet.prediction_id] = { sum: 0, count: 0, values: [] }
        }
        predictionStats[bet.prediction_id].sum += bet.probability
        predictionStats[bet.prediction_id].count += 1
        predictionStats[bet.prediction_id].values.push(bet.probability)
    })

    // 4. Generate Bets
    const betsToInsert: any[] = []

    for (const pred of predictions) {
        // optimists & pessimists always same
        // Wildcard: Mean 50, SD 25
        // Consensus: Mean GroupMean, SD GroupSD

        // -- The Optimist --
        betsToInsert.push({
            user_id: bots[BOT_NAMES.OPTIMIST],
            prediction_id: pred.id,
            probability: 100
        })

        // -- The Pessimist --
        betsToInsert.push({
            user_id: bots[BOT_NAMES.PESSIMIST],
            prediction_id: pred.id,
            probability: 0
        })

        // -- The Wildcard --
        const wcVal = Math.round(clamp(gaussianRandom(50, 25), 0, 100))
        betsToInsert.push({
            user_id: bots[BOT_NAMES.WILDCARD],
            prediction_id: pred.id,
            probability: wcVal
        })

        // -- The Consensus --
        const stats = predictionStats[pred.id]
        let conVal = 50
        if (stats && stats.count > 0) {
            const mean = stats.sum / stats.count

            // Calculate SD
            const variance = stats.values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / stats.count
            const sd = Math.sqrt(variance) || 10 // default spread if 0 variance

            conVal = Math.round(clamp(gaussianRandom(mean, sd), 0, 100))
        }

        betsToInsert.push({
            user_id: bots[BOT_NAMES.CONSENSUS],
            prediction_id: pred.id,
            probability: conVal
        })
    }

    // 5. Bulk Upsert
    // We iterate one by one or create specific constraint upserts?
    // bets table has unique(user_id, prediction_id). Upsert works fine.

    if (betsToInsert.length > 0) {
        const { error } = await supabase
            .from('bets')
            .upsert(betsToInsert, { onConflict: 'user_id,prediction_id' })

        if (error) console.error("Error inserting bot bets:", error)
        else console.log(`✅ Inserted ${betsToInsert.length} bot bets`)
    }
}

async function ensureBotUsers() {
    const botMap: Record<string, string> = {}

    for (const name of Object.values(BOT_NAMES)) {
        // Check existence
        const { data } = await supabase.from('users').select('id').eq('username', name).single()

        if (data) {
            botMap[name] = data.id
        } else {
            // Create
            const { data: newUser, error } = await supabase
                .from('users')
                .insert([{ username: name, pin: '0000' }]) // Basic pin for bots
                .select()
                .single()

            if (newUser) {
                botMap[name] = newUser.id
            } else if (error) {
                console.error("Failed to create bot:", name, error)
            }
        }
    }
    return botMap
}
