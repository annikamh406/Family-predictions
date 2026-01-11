import { supabase } from "./supabase"
import { gaussianRandom, clamp } from "./math"

export const BOT_NAMES = {
    OPTIMIST: "🌞 The Optimist",
    PESSIMIST: "🌧️ The Pessimist",
    WILDCARD: "🎲 The Wildcard",
    CONSENSUS: "📊 The Consensus"
}

export async function generateBotBets(year: number, familyId: string) {
    console.log("🤖 Generating Bot Bets for year", year, "and family", familyId)

    // 1. Ensure Bot Users Exist for this family
    const bots = await ensureBotUsers(familyId)

    // 2. Fetch Predictions for the year AND family
    const { data: predictions } = await supabase
        .from('predictions')
        .select('id')
        .eq('year', year)
        .eq('family_id', familyId)

    if (!predictions || predictions.length === 0) return

    // 3. Fetch Existing Human Bets for these predictions (for Consensus stats)
    const predictionIds = predictions.map(p => p.id)
    const { data: humanBets } = await supabase
        .from('bets')
        .select('probability, prediction_id, user_id')
        .in('prediction_id', predictionIds)

    // Get bot user IDs to filter them out
    const botUserIds = Object.values(bots)

    // Calculate stats per prediction (excluding bots)
    const predictionStats: Record<string, { sum: number, count: number, values: number[] }> = {}

    humanBets?.forEach(bet => {
        // Exclude bots from consensus calculation
        if (botUserIds.includes(bet.user_id)) return

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

        // -- The Consensus (exact average of human bets) --
        const stats = predictionStats[pred.id]
        let conVal = 50
        if (stats && stats.count > 0) {
            const mean = stats.sum / stats.count
            conVal = Math.round(clamp(mean, 0, 100))
        }

        betsToInsert.push({
            user_id: bots[BOT_NAMES.CONSENSUS],
            prediction_id: pred.id,
            probability: conVal
        })
    }

    // 5. Bulk Upsert
    if (betsToInsert.length > 0) {
        const { error } = await supabase
            .from('bets')
            .upsert(betsToInsert, { onConflict: 'user_id,prediction_id' })

        if (error) console.error("Error inserting bot bets:", error)
        else console.log(`✅ Inserted ${betsToInsert.length} bot bets for family`)
    }
}

async function ensureBotUsers(familyId: string) {
    const botMap: Record<string, string> = {}

    for (const name of Object.values(BOT_NAMES)) {
        // Check if bot exists for this family
        const { data } = await supabase
            .from('users')
            .select('id')
            .eq('username', name)
            .eq('family_id', familyId)
            .single()

        if (data) {
            botMap[name] = data.id
        } else {
            // Create bot for this family
            const { data: newUser, error } = await supabase
                .from('users')
                .insert([{ username: name, pin: '0000', family_id: familyId }])
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

// Helper to get bot names for a specific family  
export async function getBotUserIds(familyId: string): Promise<string[]> {
    const { data } = await supabase
        .from('users')
        .select('id')
        .eq('family_id', familyId)
        .in('username', Object.values(BOT_NAMES))

    return data?.map(u => u.id) || []
}
