'use client'

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/utils/supabase"
import { Loader2 } from "lucide-react"
import { BOT_NAMES } from "@/utils/bots"
import { CATEGORY_LABELS, PredictionCategory } from "@/utils/predictions"
import { cn } from "@/utils/cn"

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

type UserPoint = {
    username: string
    bullishness: number
    points: number
}

type VariabilityEntry = {
    prediction: Prediction
    values: number[]
    stdev: number
    binNames: string[][]
}

const BOT_VALUES = Object.values(BOT_NAMES)

export function ResultsStats({ year, familyId }: { year: number; familyId?: string }) {
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [bets, setBets] = useState<Bet[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function load() {
            if (!familyId) return
            setIsLoading(true)
            const { data: predsData } = await supabase
                .from('predictions')
                .select('*, user:users(username)')
                .eq('year', year)
                .eq('family_id', familyId)

            const predictionIds = predsData?.map(pred => pred.id) || []
            let betsData: Bet[] | null = []

            if (predictionIds.length > 0) {
                const { data } = await supabase
                    .from('bets')
                    .select('*, user:users(username)')
                    .in('prediction_id', predictionIds)
                betsData = data as Bet[] | null
            }

            setPredictions((predsData || []) as Prediction[])
            setBets((betsData || []) as Bet[])
            setIsLoading(false)
        }
        load()
    }, [year, familyId])

    const { userPoints, highestVar, lowestVar } = useMemo(() => {
        const humanBets = bets.filter(b => !BOT_VALUES.includes(b.user?.username))
        const betsByUser: Record<string, number[]> = {}
        const pointsByUser: Record<string, number> = {}

        bets.forEach(bet => {
            const username = bet.user?.username || "Unknown"
            if (!betsByUser[username]) betsByUser[username] = []
            betsByUser[username].push(bet.probability)

            const pred = predictions.find(p => p.id === bet.prediction_id)
            if (!pred || pred.did_happen === null) return

            const points = pred.did_happen ? bet.probability - 50 : 50 - bet.probability
            pointsByUser[username] = (pointsByUser[username] || 0) + points
        })

        const userPoints: UserPoint[] = Object.entries(betsByUser).map(([username, values]) => ({
            username,
            bullishness: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            points: pointsByUser[username] || 0
        }))

        const variability: VariabilityEntry[] = predictions.map(pred => {
            const predBets = humanBets.filter(b => b.prediction_id === pred.id)
            const values = predBets.map(b => b.probability)
            const bins: string[][] = Array.from({ length: 10 }, () => [])
            predBets.forEach(bet => {
                const idx = Math.min(9, Math.floor(bet.probability / 10))
                const username = bet.user?.username || "Unknown"
                if (!bins[idx].includes(username)) {
                    bins[idx].push(username)
                }
            })
            bins.forEach(list => list.sort())
            return {
                prediction: pred,
                values,
                stdev: values.length > 1 ? standardDeviation(values) : 0,
                binNames: bins
            }
        }).filter(entry => entry.values.length > 1)

        const sortedVar = [...variability].sort((a, b) => b.stdev - a.stdev)
        return {
            userPoints,
            highestVar: sortedVar[0] || null,
            lowestVar: sortedVar[sortedVar.length - 1] || null
        }
    }, [bets, predictions])

    if (isLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-stone-300" /></div>
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VariabilityCard title="Highest Variability" entry={highestVar} />
                <VariabilityCard title="Lowest Variability" entry={lowestVar} />
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
                <div>
                    <h3 className="text-lg font-bold text-stone-800">Bullishness vs Points</h3>
                    <p className="text-sm text-stone-500">Average bet (%) vs total points (humans only).</p>
                </div>
                {userPoints.length === 0 ? (
                    <div className="text-sm text-stone-400">No completed bets yet.</div>
                ) : (
                    <ScatterPlot points={userPoints} />
                )}
            </div>
        </div>
    )
}

function VariabilityCard({ title, entry }: { title: string; entry: VariabilityEntry | null }) {
    if (!entry) {
        return (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
                <div className="text-sm font-semibold text-stone-500">{title}</div>
                <div className="text-sm text-stone-400 pt-3">Not enough bets yet.</div>
            </div>
        )
    }

    const author = entry.prediction.user?.username || "Unknown"
    const categoryLabel = CATEGORY_LABELS[entry.prediction.category]
    const outcome = entry.prediction.did_happen

    return (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-stone-500">{title}</div>
                <div
                    className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center border text-xs font-semibold",
                        outcome === true ? "bg-green-100 border-green-300 text-green-700" :
                            outcome === false ? "bg-rose-100 border-rose-300 text-rose-700" :
                                "bg-stone-100 border-stone-200 text-stone-400"
                    )}
                >
                    {outcome === true ? "✓" : outcome === false ? "✕" : "–"}
                </div>
            </div>
            <div className="text-sm text-stone-400">{author} • {categoryLabel}</div>
            <div className="text-stone-800 font-medium leading-snug">
                {entry.prediction.description}
            </div>
            <DensityPlot values={entry.values} binNames={entry.binNames} />
        </div>
    )
}

function ScatterPlot({ points }: { points: UserPoint[] }) {
    const width = 520
    const height = 260
    const padding = 32

    const minY = Math.min(...points.map(p => p.points), 0)
    const maxY = Math.max(...points.map(p => p.points), 0)
    const yRange = maxY - minY || 1

    const yToSvg = (value: number) => {
        const normalized = (value - minY) / yRange
        return height - padding - normalized * (height - padding * 2)
    }

    const xToSvg = (value: number) => {
        const normalized = value / 100
        return padding + normalized * (width - padding * 2)
    }

    return (
        <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[420px]">
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e7e5e4" />
                <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e7e5e4" />
                <line
                    x1={padding}
                    y1={yToSvg(0)}
                    x2={width - padding}
                    y2={yToSvg(0)}
                    stroke="#d6d3d1"
                    strokeDasharray="4 4"
                />

                <text x={padding} y={height - 10} className="fill-stone-400 text-[10px]">0%</text>
                <text x={width - padding - 16} y={height - 10} className="fill-stone-400 text-[10px]">100%</text>
                <text x={8} y={padding + 4} className="fill-stone-400 text-[10px]">{maxY}</text>
                <text x={8} y={height - padding} className="fill-stone-400 text-[10px]">{minY}</text>
                <text x={width / 2} y={height - 2} className="fill-stone-500 text-[11px]" textAnchor="middle">
                    Bullishness (Avg Bet %)
                </text>
                <text
                    x={10}
                    y={height / 2}
                    className="fill-stone-500 text-[11px]"
                    textAnchor="middle"
                    transform={`rotate(-90 10 ${height / 2})`}
                >
                    Total Points
                </text>

                {points.map(point => {
                    const x = xToSvg(point.bullishness)
                    const y = yToSvg(point.points)
                    const labelOnLeft = x > width - padding - 80
                    return (
                        <g key={point.username}>
                            <circle cx={x} cy={y} r={5} className="fill-stone-800" />
                            <text
                                x={labelOnLeft ? x - 8 : x + 8}
                                y={y + 4}
                                className="fill-stone-700 text-[11px]"
                                textAnchor={labelOnLeft ? "end" : "start"}
                            >
                                {point.username}
                            </text>
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

function DensityPlot({ values, binNames }: { values: number[]; binNames: string[][] }) {
    const buckets = new Array(10).fill(0)
    values.forEach(val => {
        const idx = Math.min(9, Math.floor(val / 10))
        buckets[idx] += 1
    })
    const max = Math.max(...buckets, 1)

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-10 gap-1 h-16 items-end">
                {buckets.map((count, idx) => (
                    <div key={idx} className="relative group w-full h-full flex items-end">
                        <div
                            className={cn("rounded-sm bg-stone-200 w-full")}
                            style={{ height: `${Math.max(8, (count / max) * 100)}%` }}
                        />
                        <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-stone-800 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 shadow">
                            {idx * 10}-{idx * 10 + 9}%: {binNames[idx]?.join(", ") || "No bets"}
                        </div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-10 gap-1 text-[10px] text-stone-400">
                {Array.from({ length: 10 }).map((_, idx) => (
                    <span key={idx} className="text-center">{idx * 10}%</span>
                ))}
            </div>
        </div>
    )
}

function standardDeviation(values: number[]) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
    return Math.sqrt(variance)
}
