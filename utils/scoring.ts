export type ScoringRule = 'brier' | 'linear'

// Fixed rollout boundary: never use the current year or completion status here.
export const BRIER_START_YEAR = 2026

export function canCompareLegacyScoring(year: number): boolean {
    return year < BRIER_START_YEAR
}

type ScoredPrediction = {
    id: string
    did_happen: boolean | null
    user?: { username: string } | null
}

type ScoredBet = {
    prediction_id: string
    probability: number
    user?: { username: string } | null
}

export type Standing = {
    username: string
    score: number | null
    resolvedCount: number
    defaultCount: number
    submittedCount: number
    bullishness: number
    rank: number | null
}

export function isValidProbability(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

/** Untouched sliders are forecasts of 50%, including when no bet row was saved. */
export function forecastProbability(value: unknown): number {
    return isValidProbability(value) ? value : 50
}

/** Binary Brier loss uses probabilities in [0, 1]; lower is better. */
export function brierScore(probability: number, outcome: boolean | null): number | null {
    if (typeof outcome !== 'boolean') return null
    if (!isValidProbability(probability)) throw new RangeError('Probability must be between 0 and 100')
    return (probability / 100 - Number(outcome)) ** 2
}

export function scoreForecast(probability: number, outcome: boolean | null, rule: ScoringRule = 'brier'): number | null {
    if (rule === 'brier') return brierScore(probability, outcome)
    if (typeof outcome !== 'boolean') return null
    return outcome ? probability - 50 : 50 - probability
}

export function formatScore(score: number | null, rule: ScoringRule = 'brier'): string {
    if (score === null) return '—'
    return rule === 'brier' ? score.toFixed(4) : `${score > 0 ? '+' : ''}${Number(score.toFixed(2))}`
}

/** Rank before formatting. Treat floating-point noise as a tie, not a tiebreaker. */
export function rankStandings(standings: Standing[], rule: ScoringRule = 'brier'): Standing[] {
    const sorted = [...standings].sort((a, b) => {
        if (a.score === null) return b.score === null ? a.username.localeCompare(b.username) : 1
        if (b.score === null) return -1
        const difference = rule === 'brier' ? a.score - b.score : b.score - a.score
        return Math.abs(difference) < 1e-12 ? a.username.localeCompare(b.username) : difference
    })
    return sorted.map(entry => ({
        ...entry,
        rank: entry.score === null ? null : sorted.findIndex(other =>
            other.score !== null && Math.abs(other.score - entry.score!) < 1e-12
        ) + 1,
    }))
}

/** All participants are evaluated on the same resolved questions, with equal weights. */
export function calculateStandings(predictions: ScoredPrediction[], bets: ScoredBet[], rule: ScoringRule = 'brier'): Standing[] {
    const predictionIds = new Set(predictions.map(prediction => prediction.id))
    const participants = new Map<string, Map<string, number>>()
    for (const prediction of predictions) {
        if (prediction.user?.username) participants.set(prediction.user.username, new Map())
    }
    for (const bet of bets) {
        if (!predictionIds.has(bet.prediction_id) || !bet.user?.username) continue
        if (!participants.has(bet.user.username)) participants.set(bet.user.username, new Map())
        if (isValidProbability(bet.probability)) participants.get(bet.user.username)!.set(bet.prediction_id, bet.probability)
    }
    const resolved = predictions.filter(prediction => typeof prediction.did_happen === 'boolean')
    const standings = Array.from(participants, ([username, forecasts]): Standing => {
        let total = 0
        let defaultCount = 0
        for (const prediction of resolved) {
            const probability = forecasts.get(prediction.id)
            if (probability === undefined) defaultCount += 1
            total += scoreForecast(forecastProbability(probability), prediction.did_happen, rule)!
        }
        return {
            username,
            score: resolved.length === 0 || (rule === 'brier' && forecasts.size === 0)
                ? null : rule === 'brier' ? total / resolved.length : total,
            resolvedCount: resolved.length,
            defaultCount,
            submittedCount: forecasts.size,
            bullishness: predictions.length === 0 ? 50 : predictions.reduce((sum, prediction) =>
                sum + forecastProbability(forecasts.get(prediction.id)), 0) / predictions.length,
            rank: null,
        }
    })
    return rankStandings(standings, rule)
}
