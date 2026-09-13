'use client'

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/utils/supabase"
import { Loader2, Check, X, Minus } from "lucide-react"
import {
    CATEGORY_LABELS,
    CATEGORY_COLORS,
    sortPredictionsByCategory,
    PredictionCategory
} from "@/utils/predictions"
import { cn } from "@/utils/cn"
import { calculateStandings, forecastProbability, formatScore, scoreForecast, ScoringRule } from "@/utils/scoring"

type Prediction = {
    id: string
    description: string
    category: PredictionCategory
    did_happen: boolean | null
    user: { username: string }
}

type Bet = {
    prediction_id: string
    probability: number
    user: { username: string }
}

export function ResultsSummary({ year, familyId, scoringRule = 'brier' }: { year: number; familyId?: string; scoringRule?: ScoringRule }) {
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [bets, setBets] = useState<Record<string, Record<string, number>>>({}) // [predId][username] -> prob
    const [users, setUsers] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [sortMode, setSortMode] = useState<'alpha' | 'avg_bullishness' | 'score'>('score')

    const standings = useMemo(() => calculateStandings(predictions, Object.entries(bets).flatMap(([prediction_id, forecasts]) =>
        Object.entries(forecasts).map(([username, probability]) => ({ prediction_id, probability, user: { username } }))
    ), scoringRule), [predictions, bets, scoringRule])
    const scoresByUser = new Map(standings.map(standing => [standing.username, standing]))
    const sortedUsers = sortMode === 'alpha' ? [...users].sort()
        : sortMode === 'avg_bullishness' ? [...standings].sort((a, b) => b.bullishness - a.bullishness).map(s => s.username)
        : standings.map(s => s.username)

    useEffect(() => {
        async function load() {
            // Get Predictions
            let predQuery = supabase
                .from('predictions')
                .select('*, user:users(username)')
                .eq('year', year)

            if (familyId) {
                predQuery = predQuery.eq('family_id', familyId)
            }

            const { data: predsData } = await predQuery
            const predictionIds = predsData?.map(pred => pred.id) || []
            let betsData: Bet[] | null = []

            if (predictionIds.length > 0) {
                const { data } = await supabase
                    .from('bets')
                    .select('*, user:users(username)')
                    .in('prediction_id', predictionIds)
                betsData = data as Bet[] | null
            }

            if (predsData && betsData) {
                const sortedPreds = sortPredictionsByCategory(predsData as Prediction[])
                setPredictions(sortedPreds)

                const betsMap: Record<string, Record<string, number>> = {}
                const userSet = new Set<string>()

                // Include prediction authors even if they didn't place bets
                sortedPreds.forEach(pred => {
                    if (pred.user?.username) {
                        userSet.add(pred.user.username)
                    }
                })

                // Process Bets
                betsData.forEach((b: Bet) => {
                    const username = b.user?.username
                    if (!username) return
                    userSet.add(username)

                    if (!betsMap[b.prediction_id]) betsMap[b.prediction_id] = {}
                    betsMap[b.prediction_id][username] = b.probability
                })

                setBets(betsMap)
                setUsers(Array.from(userSet).sort())
            }
            setLoading(false)
        }
        load()
    }, [year, familyId])

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-stone-300" /></div>

    return (
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto rounded-xl border border-stone-200 shadow-sm text-sm">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between gap-3">
                <span className="text-xs text-stone-500">{scoringRule === 'brier' ? 'Brier score · Lower is better · Default bets: 50%' : 'Old scoring · Higher is better'}</span>
                <select
                    aria-label="Sort results columns"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as 'alpha' | 'avg_bullishness' | 'score')}
                    className="h-8 px-2 rounded-md border border-stone-200 bg-white text-xs text-stone-600"
                >
                    <option value="score">Sort: Score</option>
                    <option value="avg_bullishness">Sort: Avg Bullishness</option>
                    <option value="alpha">Sort: A-Z</option>
                </select>
            </div>
            <table className="w-full text-left whitespace-nowrap border-collapse">
                <thead className="text-xs text-stone-500 uppercase bg-stone-50 text-center">
                    <tr>
                        <th className="px-4 py-3 min-w-[50px] sticky top-0 md:left-0 md:sticky bg-stone-50 z-30 border-b border-stone-200">
                            Out
                        </th>
                        <th className="px-4 py-3 min-w-[300px] text-left sticky top-0 md:left-[50px] md:sticky bg-stone-50 z-30 border-b border-r border-stone-200">
                            Prediction
                        </th>
                        {sortedUsers.map(u => (
                            <th key={u} className="px-2 py-3 min-w-[80px] border-b border-stone-100 font-bold text-stone-600 sticky top-0 bg-stone-50 z-20">
                                {u.slice(0, 10)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {predictions.map(pred => (
                        <tr key={pred.id} className="hover:bg-stone-50/50 border-b border-stone-50 last:border-0">
                            {/* Outcome (Sticky Col 1) */}
                            <td className="px-2 py-3 text-center md:sticky md:left-0 bg-white md:z-10 border-r border-stone-100">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center mx-auto",
                                    pred.did_happen === true ? "bg-green-100 text-green-600" :
                                        pred.did_happen === false ? "bg-rose-100 text-rose-600" :
                                            "bg-stone-50 text-stone-300"
                                )}>
                                    {pred.did_happen === true ? <Check className="w-4 h-4" /> :
                                        pred.did_happen === false ? <X className="w-4 h-4" /> :
                                            <Minus className="w-4 h-4" />}
                                </div>
                            </td>

                            {/* Prediction (Sticky Col 2) */}
                            <td className="px-4 py-3 md:sticky md:left-[50px] bg-white md:z-10 border-r border-stone-100 max-w-[400px]">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", CATEGORY_COLORS[pred.category])}>
                                            {CATEGORY_LABELS[pred.category]}
                                        </span>
                                        <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">
                                            By {pred.user?.username}
                                        </span>
                                    </div>
                                    <span className="whitespace-normal leading-snug text-stone-800 font-medium">
                                        {pred.description}
                                    </span>
                                </div>
                            </td>

                            {/* User Scores */}
                            {sortedUsers.map(u => {
                                const val = forecastProbability(bets[pred.id]?.[u])
                                const isDefault = bets[pred.id]?.[u] === undefined
                                const score = scoreForecast(val, pred.did_happen, scoringRule)

                                return (
                                    <td key={u} className="px-2 py-3 text-center border-l border-dotted border-stone-100">
                                        <div className="flex flex-col items-center">
                                            <span className={cn(
                                                "text-sm font-semibold mb-1",
                                                isDefault ? "text-stone-400" : "text-stone-600"
                                            )}>
                                                {val}%{isDefault && <span className="block text-[10px] font-normal">default</span>}
                                            </span>
                                            {score !== null ? (
                                                <span className={cn(
                                                    "font-bold font-mono text-sm",
                                                    "text-stone-700"
                                                )}>
                                                    {formatScore(score, scoringRule)}
                                                </span>
                                            ) : (
                                                <span className="text-stone-300 text-xs">-</span>
                                            )}
                                        </div>
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                    {predictions.length === 0 && (
                        <tr><td colSpan={users.length + 2} className="p-8 text-center text-stone-400">No data found</td></tr>
                    )}
                </tbody>
                {/* Footer with Totals */}
                <tfoot className="bg-stone-50 border-t-2 border-stone-200">
                    <tr>
                        <td colSpan={2} className="px-4 py-4 text-right font-bold text-stone-600 uppercase text-xs tracking-wider sticky left-0 bg-stone-50 z-10 border-r border-stone-200">
                            {scoringRule === 'brier' ? 'Average Brier score' : 'Total Points'}
                        </td>
                        {sortedUsers.map(u => {
                            const totalScore = scoresByUser.get(u)?.score ?? null

                            return (
                                <td key={u} className="px-2 py-4 text-center border-l border-stone-200">
                                    <span className={cn(
                                        "font-bold font-mono text-base",
                                        "text-stone-700"
                                    )}>
                                        {formatScore(totalScore, scoringRule)}
                                    </span>
                                    <div className="text-[10px] text-stone-400">{totalScore === null ? 'Unranked' : `${scoresByUser.get(u)?.resolvedCount} scored`}</div>
                                </td>
                            )
                        })}
                    </tr>
                    <tr>
                        <td colSpan={2} className="px-4 py-3 text-right font-bold text-stone-500 uppercase text-[10px] tracking-wider sticky left-0 bg-stone-50 z-10 border-r border-stone-200">
                            Avg Bullishness
                        </td>
                        {sortedUsers.map(u => {
                            const totalProb = predictions.reduce((acc, pred) => {
                                const val = forecastProbability(bets[pred.id]?.[u])
                                return acc + val
                            }, 0)
                            const avg = Math.round(totalProb / (predictions.length || 1))

                            return (
                                <td key={u} className="px-2 py-3 text-center border-l border-stone-200">
                                    <span className="font-mono text-xs text-stone-600 bg-stone-200 px-1.5 py-0.5 rounded">
                                        {avg}%
                                    </span>
                                </td>
                            )
                        })}
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}
