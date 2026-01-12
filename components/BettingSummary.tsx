'use client'

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/utils/supabase"
import { Loader2 } from "lucide-react"
import {
    CATEGORY_LABELS,
    CATEGORY_COLORS,
    sortPredictionsByCategory,
    PredictionCategory
} from "@/utils/predictions"
import { cn } from "@/utils/cn"

type Prediction = {
    id: string
    description: string
    category: PredictionCategory
    user: { username: string }
}

type Bet = {
    prediction_id: string
    probability: number
    user: { username: string }
}

export function BettingSummary({ year, familyId }: { year: number; familyId?: string }) {
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [bets, setBets] = useState<Record<string, Record<string, number>>>({}) // [predId][username] -> prob
    const [users, setUsers] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [sortMode, setSortMode] = useState<'alpha' | 'avg_bullishness'>('alpha')

    const sortedUsers = useMemo(() => {
        if (sortMode === 'alpha') {
            return [...users].sort()
        }

        const averages: Record<string, number> = {}
        users.forEach(u => {
            let total = 0
            let count = 0
            predictions.forEach(pred => {
                const val = bets[pred.id]?.[u]
                if (val !== undefined) {
                    total += val
                    count += 1
                }
            })
            averages[u] = count > 0 ? total / count : 0
        })

        return [...users].sort((a, b) => (averages[b] ?? 0) - (averages[a] ?? 0))
    }, [users, predictions, bets, sortMode])

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
                betsData.forEach((b: any) => {
                    const username = b.user.username
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
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-end">
                <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as 'alpha' | 'avg_bullishness')}
                    className="h-8 px-2 rounded-md border border-stone-200 bg-white text-xs text-stone-600"
                >
                    <option value="alpha">Sort: A-Z</option>
                    <option value="avg_bullishness">Sort: Avg Bullishness</option>
                </select>
            </div>
            <table className="w-full text-left whitespace-nowrap border-collapse">
                <thead className="text-xs text-stone-500 uppercase bg-stone-50 text-center">
                    <tr>
                        <th className="px-4 py-3 min-w-[300px] text-left sticky top-0 md:left-0 md:sticky bg-stone-50 z-30 border-b border-r border-stone-200">
                            Prediction
                        </th>
                        {sortedUsers.map(u => (
                            <th key={u} className="px-2 py-3 min-w-[80px] border-b border-stone-100 font-bold text-stone-600 rotate-0 sticky top-0 bg-stone-50 z-20">
                                {u.slice(0, 10)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {predictions.map(pred => (
                        <tr key={pred.id} className="hover:bg-stone-50/50 border-b border-stone-50 last:border-0">
                            <td className="px-4 py-3 md:sticky md:left-0 bg-white md:z-10 border-r border-stone-100 max-w-[400px]">
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
                            {sortedUsers.map(u => {
                                const val = bets[pred.id]?.[u] ?? 50
                                const isDefault = bets[pred.id]?.[u] === undefined
                                return (
                                    <td key={u} className="px-2 py-3 text-center border-l border-dotted border-stone-100">
                                        <span className={cn(
                                            "inline-block px-1.5 py-0.5 rounded font-mono font-bold text-xs",
                                            val >= 80 ? "bg-green-100 text-green-700" :
                                                val <= 20 ? "bg-stone-100 text-stone-400" :
                                                    "bg-yellow-50 text-yellow-700",
                                            isDefault && "opacity-50 grayscale"
                                        )}>
                                            {val}%
                                        </span>
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                    {predictions.length === 0 && (
                        <tr><td colSpan={users.length + 1} className="p-8 text-center text-stone-400">No data found</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
