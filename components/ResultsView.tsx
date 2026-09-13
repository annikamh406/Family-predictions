'use client'

import { useState, useEffect, useMemo } from "react"
import { useUser } from "@/contexts/UserContext"
import { supabase } from "@/utils/supabase"
import { Loader2, Trophy, Medal, Bot, Lock, LayoutGrid, Table2 } from "lucide-react"
import { cn } from "@/utils/cn"
import { ResultsSummary } from "./ResultsSummary"
import { ResultsStats } from "./ResultsStats"
import {
    CATEGORY_LABELS,
    CATEGORY_COLORS,
    CATEGORY_BG_COLORS,
    sortPredictionsByCategory,
    PredictionCategory
} from "@/utils/predictions"
import { BOT_NAMES, generateBotBets } from "@/utils/bots"
import { calculateStandings, canCompareLegacyScoring, formatScore, rankStandings, ScoringRule } from "@/utils/scoring"

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

type PredictionStats = {
    avg: number
    min: number
    max: number
    count: number
}

export function ResultsView({ year, isLocked = false }: { year: number, isLocked?: boolean }) {
    const { viewingFamily, isViewingOtherFamily } = useUser()
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [bets, setBets] = useState<Bet[]>([])
    const [selectedRule, setSelectedRule] = useState<ScoringRule>('brier')
    const scoringRule = canCompareLegacyScoring(year) ? selectedRule : 'brier'
    const scores = useMemo(() => calculateStandings(predictions, bets, scoringRule), [predictions, bets, scoringRule])
    const [predStats, setPredStats] = useState<Record<string, PredictionStats>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [showBots, setShowBots] = useState(false)
    const [isGeneratingBots, setIsGeneratingBots] = useState(false)
    const [viewMode, setViewMode] = useState<'cards' | 'summary' | 'stats'>('cards')

    useEffect(() => {
        fetchData()
    }, [year, viewingFamily?.id])

    const fetchData = async () => {
        if (!viewingFamily) return

        const { data: preds } = await supabase
            .from('predictions')
            .select('*, user:users(username)')
            .eq('year', year)
            .eq('family_id', viewingFamily.id)

        const predictionIds = preds?.map(pred => pred.id) || []
        let allBets: Bet[] | null = []

        if (predictionIds.length > 0) {
            const { data } = await supabase
                .from('bets')
                .select('*, user:users(username)')
                .in('prediction_id', predictionIds)
            allBets = data as Bet[] | null
        }

        if (preds) {
            const sorted = sortPredictionsByCategory(preds as Prediction[])
            setPredictions(sorted)
        }
        if (allBets) {
            setBets(allBets)
            calculateStats(allBets)
        }
        setIsLoading(false)
    }

    const hasBotBets = (allBets: Bet[]) => {
        const botValues = Object.values(BOT_NAMES)
        return allBets.some(bet => botValues.includes(bet.user?.username))
    }

    const ensureBots = async () => {
        if (!viewingFamily || isViewingOtherFamily || isGeneratingBots) return
        if (hasBotBets(bets)) return

        setIsGeneratingBots(true)
        try {
            await generateBotBets(year, viewingFamily.id)
            await fetchData()
        } finally {
            setIsGeneratingBots(false)
        }
    }

    useEffect(() => {
        if (showBots) {
            ensureBots()
        }
    }, [showBots, viewingFamily?.id, year])

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

    const setOutcome = async (predictionId: string, newStatus: boolean | null) => {
        if (isLocked || isViewingOtherFamily) return // Verify lock and family

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
    const displayedScores = rankStandings(showBots ? scores : scores.filter(s => !botValues.includes(s.username)), scoringRule)
    const top3 = displayedScores.filter(s => s.rank !== null && s.rank <= 3)
    const resolvedCount = predictions.filter(p => typeof p.did_happen === 'boolean').length

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin w-6 h-6 mx-auto text-stone-300" /></div>

    return (
        <div className="space-y-8">
            {isLocked && (
                <div className="bg-stone-800 text-stone-100 p-4 rounded-xl flex items-center justify-center gap-3 shadow-lg">
                    <Lock className="w-5 h-5 text-yellow-400" />
                    <span className="font-bold">Game Complete! Results are Final.</span>
                </div>
            )}

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold text-stone-800">{scoringRule === 'brier' ? 'Brier score · Lower is better' : 'Old scoring · Higher is better'}</h3>
                    {canCompareLegacyScoring(year) && (
                        <label className="flex items-center gap-2 text-sm text-stone-600">
                            Compare scoring
                            <select value={scoringRule} onChange={e => setSelectedRule(e.target.value as ScoringRule)} className="rounded-lg border border-stone-300 bg-white p-2">
                                <option value="brier">Brier scoring</option>
                                <option value="linear">Old scoring</option>
                            </select>
                        </label>
                    )}
                </div>
                <p className="text-sm text-stone-600">
                    {scoringRule === 'brier'
                        ? 'Your score is the average squared error across resolved predictions: 0 is perfect, 0.25 is always betting 50%, and 1 is the worst possible score. Untouched bets count as 50%; submit at least one bet to join the standings.'
                        : 'The original rules: bet − 50 if it happened, 50 − bet if it didn’t. Points are added across resolved predictions.'}
                </p>
                <p className="text-xs text-stone-500">{resolvedCount} of {predictions.length} predictions resolved. Unresolved predictions do not count. Equal scores share a rank.</p>
            </div>

            {/* Shared ranks include everyone tied for a podium place. */}
            {top3.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {top3.map(entry => (
                        <div key={entry.username} className={cn("rounded-2xl border p-5 text-center space-y-2", entry.rank === 1 ? "bg-yellow-100 border-yellow-300" : "bg-stone-50 border-stone-200")}>
                            <div className="flex items-center justify-center gap-2">{getRankIcon(entry.rank! - 1)}<span className="text-sm font-semibold">#{entry.rank}</span></div>
                            <div className="font-bold text-stone-800 break-words">{entry.username}</div>
                            <div className="font-mono text-2xl font-bold text-stone-700">{formatScore(entry.score, scoringRule)}</div>
                            <div className="text-xs text-stone-500">{scoringRule === 'brier' ? 'Average Brier score' : 'Total points'}</div>
                        </div>
                    ))}
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
                                onClick={() => setShowBots(prev => !prev)}
                                disabled={isGeneratingBots}
                                aria-label="Include bots in standings"
                                aria-pressed={showBots}
                                className={cn("w-8 h-4 rounded-full relative transition-colors duration-300",
                                    showBots ? "bg-stone-800" : "bg-stone-300",
                                    isGeneratingBots && "opacity-60 cursor-not-allowed"
                                )}
                            >
                                <div className={cn("w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform duration-300 shadow-sm",
                                    showBots ? "left-4.5 translate-x-0" : "left-0.5"
                                )} />
                            </button>
                        </div>
                    </div>
                    <span className="text-xs text-stone-400">{displayedScores.filter(s => s.rank !== null).length} Ranked</span>
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
                    {displayedScores.map((s) => (
                        <div key={s.username} className={cn("flex items-center justify-between p-4 hover:bg-stone-50 transition-colors",
                            s.rank !== null && s.rank <= 3 ? "bg-stone-50/50" : ""
                        )}>
                            <div className="flex items-center gap-4">
                                <div className="w-8 flex justify-center">{s.rank === null ? '—' : getRankIcon(s.rank - 1)}</div>
                                <span className={cn("font-medium flex items-center gap-2",
                                    s.rank === 1 ? "text-stone-900 font-bold" : "text-stone-700"
                                )}>
                                    {s.username}
                                    {botValues.includes(s.username) && <Bot className="w-3 h-3 text-stone-300" />}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="font-mono font-medium text-stone-700">{formatScore(s.score, scoringRule)}</span>
                                <div className="text-xs text-stone-400">
                                    {s.score === null ? (s.submittedCount === 0 ? 'No bets submitted' : 'Awaiting outcomes') : `${s.resolvedCount} scored · ${s.defaultCount} default bets`}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="pt-8 space-y-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-stone-800">Event Results</h3>
                        <p className="text-stone-500">
                            {isLocked ? "Final Results. Locked." : "Sorted by likelihood. Admin click to toggle."}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('cards')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                viewMode === 'cards' ? "bg-stone-800 text-white shadow-md" : "bg-white text-stone-500 hover:bg-stone-50"
                            )}
                        >
                            <LayoutGrid className="w-4 h-4" /> Events
                        </button>
                        <button
                            onClick={() => setViewMode('summary')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                viewMode === 'summary' ? "bg-stone-800 text-white shadow-md" : "bg-white text-stone-500 hover:bg-stone-50"
                            )}
                        >
                            <Table2 className="w-4 h-4" /> Summary
                        </button>
                        <button
                            onClick={() => setViewMode('stats')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                viewMode === 'stats' ? "bg-stone-800 text-white shadow-md" : "bg-white text-stone-500 hover:bg-stone-50"
                            )}
                        >
                            📈 Stats
                        </button>
                    </div>
                </div>

                {viewMode === 'summary' ? (
                    <ResultsSummary year={year} familyId={viewingFamily?.id} scoringRule={scoringRule} />
                ) : viewMode === 'stats' ? (
                    <ResultsStats year={year} familyId={viewingFamily?.id} scoringRule={scoringRule} />
                ) : (
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

                                <OutcomeSlider
                                    value={pred.did_happen}
                                    onChange={(val) => setOutcome(pred.id, val)}
                                    disabled={isLocked || isViewingOtherFamily}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function OutcomeSlider({
    value,
    onChange,
    disabled
}: {
    value: boolean | null
    onChange: (val: boolean | null) => void
    disabled?: boolean
}) {
    const sliderValue = value === true ? 1 : value === false ? -1 : 0
    const accentClass =
        sliderValue === 1 ? "accent-green-600" :
            sliderValue === -1 ? "accent-rose-600" :
                "accent-stone-400"

    return (
        <div className="shrink-0 flex flex-col items-center gap-3">
            <div className="text-[10px] text-stone-400 uppercase tracking-widest">Outcome</div>
            <div className="relative w-20">
                <input
                    type="range"
                    min={-1}
                    max={1}
                    step={1}
                    value={sliderValue}
                    onChange={(e) => {
                        const next = Number(e.target.value)
                        onChange(next === 1 ? true : next === -1 ? false : null)
                    }}
                    disabled={disabled}
                    className={cn(
                        "w-full h-4 rounded-full appearance-none bg-stone-200 cursor-pointer",
                        accentClass,
                        disabled && "opacity-70 cursor-not-allowed"
                    )}
                />
                <div className="absolute -top-4 left-0 right-0 flex justify-between text-sm font-semibold">
                    <span className="text-rose-600">✕</span>
                    <span className="text-stone-400">–</span>
                    <span className="text-green-600">✓</span>
                </div>
            </div>
        </div>
    )
}
