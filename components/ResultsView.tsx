'use client'

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/UserContext"
import { supabase } from "@/utils/supabase"
import { Button } from "./ui/Button"
import { Loader2, Trophy, Check, X, Minus, Medal, Info, Bot, Lock } from "lucide-react"
import { cn } from "@/utils/cn"
import {
    CATEGORY_LABELS,
    CATEGORY_COLORS,
    CATEGORY_BG_COLORS,
    sortPredictionsByCategory,
    PredictionCategory
} from "@/utils/predictions"
import { BOT_NAMES } from "@/utils/bots"

type Prediction = {
    id: string
    description: string
    category: PredictionCategory
    did_happen: boolean | null
    user: { username: string }
}

type Bet = {
    user_id: string
    prediction_id: string
    probability: number
    user: { username: string }
}

type Score = {
    username: string
    score: number
}

type PredictionStats = {
    avg: number
    min: number
    max: number
    count: number
}

export function ResultsView({ year, isLocked = false }: { year: number, isLocked?: boolean }) {
    const { user } = useUser()
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [bets, setBets] = useState<Bet[]>([])
    const [scores, setScores] = useState<Score[]>([])
    const [predStats, setPredStats] = useState<Record<string, PredictionStats>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [showBots, setShowBots] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        const { data: preds } = await supabase
            .from('predictions')
            .select('*, user:users(username)')
            .eq('year', year)

        const { data: allBets } = await supabase
            .from('bets')
            .select('*, user:users(username)')

        if (preds) {
            const sorted = sortPredictionsByCategory(preds as Prediction[])
            setPredictions(sorted)
        }
        if (allBets) {
            setBets(allBets as any)
            calculateStats(allBets as any)
        }
        setIsLoading(false)
    }

    const calculateStats = (allBets: Bet[]) => {
        const stats: Record<string, { sum: number, vals: number[] }> = {}
        const botValues = Object.values(BOT_NAMES)

        allBets.forEach(b => {
            if (botValues.includes(b.user?.username)) return

            if (!stats[b.prediction_id]) {
                stats[b.prediction_id] = { sum: 0, vals: [] }
            }
            stats[b.prediction_id].sum += b.probability
            stats[b.prediction_id].vals.push(b.probability)
        })

        const finalStats: Record<string, PredictionStats> = {}
        Object.keys(stats).forEach(id => {
            const { sum, vals } = stats[id]
            finalStats[id] = {
                avg: Math.round(sum / vals.length),
                min: Math.min(...vals),
                max: Math.max(...vals),
                count: vals.length
            }
        })
        setPredStats(finalStats)
    }

    useEffect(() => {
        if (predictions.length === 0 || bets.length === 0) return

        const userScores: Record<string, number> = {}

        bets.forEach(bet => {
            const pred = predictions.find(p => p.id === bet.prediction_id)
            if (!pred || pred.did_happen === null) return

            const outcome = pred.did_happen
            let points = 0

            if (outcome) {
                points = bet.probability - 50
            } else {
                points = 50 - bet.probability
            }

            const username = bet.user?.username || 'Unknown'
            userScores[username] = (userScores[username] || 0) + points
        })

        const sortedScores = Object.entries(userScores)
            .map(([username, score]) => ({ username, score }))
            .sort((a, b) => b.score - a.score)

        setScores(sortedScores)

    }, [predictions, bets])

    const toggleOutcome = async (predictionId: string, currentStatus: boolean | null) => {
        if (isLocked) return // Verify lock just in case

        let newStatus: boolean | null = null
        if (currentStatus === null) newStatus = true
        else if (currentStatus === true) newStatus = false
        else newStatus = null

        setPredictions(prev => prev.map(p => p.id === predictionId ? { ...p, did_happen: newStatus } : p))

        const { error } = await supabase
            .from('predictions')
            .update({ did_happen: newStatus })
            .eq('id', predictionId)

        if (error) {
            console.error(error)
            fetchData()
        }
    }

    const getRankIcon = (idx: number) => {
        if (idx === 0) return <Trophy className="w-5 h-5 text-yellow-600" />
        if (idx === 1) return <Medal className="w-5 h-5 text-stone-400" />
        if (idx === 2) return <Medal className="w-5 h-5 text-orange-600" />
        return <span className="w-5 font-mono text-center text-stone-300 text-sm">#{idx + 1}</span>
    }

    const botValues = Object.values(BOT_NAMES)
    const displayedScores = showBots
        ? scores
        : scores.filter(s => !botValues.includes(s.username))

    const top3 = displayedScores.slice(0, 3)

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin w-6 h-6 mx-auto text-stone-300" /></div>

    return (
        <div className="space-y-8">
            {isLocked && (
                <div className="bg-stone-800 text-stone-100 p-4 rounded-xl flex items-center justify-center gap-3 shadow-lg">
                    <Lock className="w-5 h-5 text-yellow-400" />
                    <span className="font-bold">Game Complete! Results are Final.</span>
                </div>
            )}

            {/* Top 3 Podium */}
            {top3.length > 0 && (
                <div className="grid grid-cols-3 gap-4 items-end mb-8 pt-8">
                    {/* Silver */}
                    {top3[1] && (
                        <div className="flex flex-col items-center">
                            <div className="text-sm font-bold text-stone-500 mb-2 truncate max-w-full text-center">{top3[1].username}</div>
                            <div className="w-full h-24 bg-stone-200 rounded-t-xl relative flex items-center justify-center border-t border-l border-r border-white/50 shadow-sm">
                                <span className="font-bold text-stone-500 text-xl">{top3[1].score}</span>
                                <div className="absolute -top-3 bg-stone-300 rounded-full p-1 border-2 border-white">
                                    <span className="text-xs font-bold text-white px-1">2</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Gold */}
                    {top3[0] && (
                        <div className="flex flex-col items-center z-10 -mx-2">
                            <div className="mb-2 flex flex-col items-center">
                                <Trophy className="w-8 h-8 text-yellow-500 animate-bounce" />
                                <div className="text-lg font-bold text-stone-800 truncate max-w-full text-center">{top3[0].username}</div>
                            </div>
                            <div className="w-full h-32 bg-yellow-300 rounded-t-xl relative flex items-center justify-center border-t border-l border-r border-white/50 shadow-lg bg-gradient-to-b from-yellow-300 to-yellow-400">
                                <span className="font-bold text-yellow-900 text-3xl">{top3[0].score}</span>
                                <div className="absolute -top-3 bg-yellow-500 rounded-full p-1 border-2 border-white shadow">
                                    <span className="text-xs font-bold text-white px-2">1</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bronze */}
                    {top3[2] && (
                        <div className="flex flex-col items-center">
                            <div className="text-sm font-bold text-stone-500 mb-2 truncate max-w-full text-center">{top3[2].username}</div>
                            <div className="w-full h-20 bg-orange-200 rounded-t-xl relative flex items-center justify-center border-t border-l border-r border-white/50 shadow-sm">
                                <span className="font-bold text-orange-800 text-xl">{top3[2].score}</span>
                                <div className="absolute -top-3 bg-orange-300 rounded-full p-1 border-2 border-white">
                                    <span className="text-xs font-bold text-white px-1">3</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* List Leaderboard */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-stone-600 text-sm uppercase tracking-wider">Standings</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-400">Bots</span>
                            <button
                                onClick={() => setShowBots(!showBots)}
                                className={cn("w-8 h-4 rounded-full relative transition-colors duration-300",
                                    showBots ? "bg-stone-800" : "bg-stone-300"
                                )}
                            >
                                <div className={cn("w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform duration-300 shadow-sm",
                                    showBots ? "left-4.5 translate-x-0" : "left-0.5"
                                )} />
                            </button>
                        </div>
                    </div>
                    <span className="text-xs text-stone-400">{displayedScores.length} Ranked</span>
                </div>

                {/* Bot Explainer */}
                {showBots && (
                    <div className="p-4 bg-stone-100 text-xs text-stone-500 border-b border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2"><Bot className="w-3 h-3" /> <strong>{BOT_NAMES.OPTIMIST}:</strong> Always bets 100%</div>
                        <div className="flex items-center gap-2"><Bot className="w-3 h-3" /> <strong>{BOT_NAMES.PESSIMIST}:</strong> Always bets 0%</div>
                        <div className="flex items-center gap-2"><Bot className="w-3 h-3" /> <strong>{BOT_NAMES.WILDCARD}:</strong> Bets randomly (Mean 50)</div>
                        <div className="flex items-center gap-2"><Bot className="w-3 h-3" /> <strong>{BOT_NAMES.CONSENSUS}:</strong> Mimics the family average</div>
                    </div>
                )}

                <div className="divide-y divide-stone-100">
                    {displayedScores.map((s, idx) => (
                        <div key={s.username} className={cn("flex items-center justify-between p-4 hover:bg-stone-50 transition-colors",
                            idx < 3 ? "bg-stone-50/50" : ""
                        )}>
                            <div className="flex items-center gap-4">
                                <div className="w-8 flex justify-center">{getRankIcon(idx)}</div>
                                <span className={cn("font-medium flex items-center gap-2",
                                    idx === 0 ? "text-stone-900 font-bold" : "text-stone-700"
                                )}>
                                    {s.username}
                                    {botValues.includes(s.username) && <Bot className="w-3 h-3 text-stone-300" />}
                                </span>
                            </div>
                            <span className={cn("font-mono font-medium",
                                s.score > 0 ? "text-green-600" : s.score < 0 ? "text-rose-600" : "text-stone-400"
                            )}>
                                {s.score > 0 ? `+${s.score}` : s.score}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="pt-8 space-y-4">
                <div>
                    <h3 className="text-xl font-bold text-stone-800">Event Results</h3>
                    <p className="text-stone-500">
                        {isLocked ? "Final Results. Locked." : "Sorted by likelihood. Admin click to toggle."}
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {predictions.map((pred) => (
                        <div
                            key={pred.id}
                            className={cn(
                                "flex items-center justify-between gap-4 p-5 rounded-xl border transition-all hover:scale-[1.01]",
                                "glass-panel shadow-sm",
                                CATEGORY_BG_COLORS[pred.category]
                            )}
                        >
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                                        CATEGORY_COLORS[pred.category]
                                    )}>
                                        {pred.user?.username.slice(0, 10)} &bull; {CATEGORY_LABELS[pred.category]}
                                    </span>
                                    {predStats[pred.id] && (
                                        <div className="flex gap-2">
                                            <span className="text-xs font-bold text-stone-600 bg-white/80 px-2 py-1 rounded-md border border-stone-200 shadow-sm flex items-center gap-1">
                                                👥 Avg: {predStats[pred.id].avg}%
                                            </span>
                                            <span className="text-xs text-stone-500 bg-white/50 px-2 py-1 rounded-md border border-stone-200 flex items-center gap-1">
                                                Range: {predStats[pred.id].min}% - {predStats[pred.id].max}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-stone-800 font-medium text-lg leading-snug">{pred.description}</p>
                            </div>

                            <button
                                onClick={() => toggleOutcome(pred.id, pred.did_happen)}
                                disabled={isLocked}
                                className={cn(
                                    "shrink-0 h-10 w-10 rounded-full flex items-center justify-center border transition-all",
                                    pred.did_happen === true ? "bg-green-100 border-green-300 text-green-700 shadow-sm" :
                                        pred.did_happen === false ? "bg-rose-100 border-rose-300 text-rose-700 shadow-sm" :
                                            "bg-stone-100 border-stone-200 text-stone-300",
                                    !isLocked && "hover:bg-stone-200",
                                    isLocked && "opacity-80 cursor-not-allowed"
                                )}
                            >
                                {pred.did_happen === true ? <Check className="w-5 h-5" /> :
                                    pred.did_happen === false ? <X className="w-5 h-5" /> :
                                        <Minus className="w-5 h-5" />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
