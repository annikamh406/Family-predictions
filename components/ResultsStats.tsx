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
    binNames: string[]
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

    const { userPoints, humanPoints, highestVar, lowestVar, categoryStats } = useMemo(() => {
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
                binNames: bins.map(list => list.join(", "))
            }
        }).filter(entry => entry.values.length > 1)

        const sortedVar = [...variability].sort((a, b) => b.stdev - a.stdev)
        const humanPoints: UserPoint[] = Object.entries(betsByUser)
            .filter(([username]) => !BOT_VALUES.includes(username))
            .map(([username, values]) => ({
                username,
                bullishness: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
                points: pointsByUser[username] || 0
            }))

        const categoryStats = Object.keys(CATEGORY_LABELS).map((category) => {
            const catPreds = predictions.filter(pred => pred.category === category)
            const predIds = new Set(catPreds.map(pred => pred.id))
            const catBets = humanBets.filter(b => predIds.has(b.prediction_id))
            const values = catBets.map(b => b.probability)
            const happened = catPreds.filter(pred => pred.did_happen === true).length
            const notHappened = catPreds.filter(pred => pred.did_happen === false).length
            const unknown = catPreds.filter(pred => pred.did_happen === null).length
            return {
                category: category as PredictionCategory,
                values,
                happened,
                notHappened,
                unknown
            }
        })

        return {
            userPoints,
            humanPoints,
            highestVar: sortedVar[0] || null,
            lowestVar: sortedVar[sortedVar.length - 1] || null,
            categoryStats
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
                    <p className="text-sm text-stone-500">Average bet (%) vs total points (includes bots).</p>
                </div>
                {userPoints.length === 0 ? (
                    <div className="text-sm text-stone-400">No completed bets yet.</div>
                ) : (
                    <ScatterPlot points={userPoints} humanPoints={humanPoints} />
                )}
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
                <div>
                    <h3 className="text-lg font-bold text-stone-800">Category Stats</h3>
                    <p className="text-sm text-stone-500">Distribution of human bets by likelihood category.</p>
                </div>
                <CategoryOutcomeChart stats={categoryStats} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoryStats.map(stat => (
                        <div key={stat.category} className="border border-stone-200 rounded-2xl p-4 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <div className="font-semibold text-stone-700">{CATEGORY_LABELS[stat.category]}</div>
                                <div className="text-sm text-stone-600 sm:text-right">
                                    {stat.happened} happened • {stat.notHappened} didn't • {stat.unknown} unknown
                                </div>
                            </div>
                            {stat.values.length === 0 ? (
                                <div className="text-sm text-stone-400">No bets yet.</div>
                            ) : (
                                <DensityPlot
                                    values={stat.values}
                                    binNames={buildCountLabels(stat.values)}
                                    showAxisLabels
                                    showMeanLine
                                />
                            )}
                        </div>
                    ))}
                </div>
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

function ScatterPlot({ points, humanPoints }: { points: UserPoint[]; humanPoints: UserPoint[] }) {
    const width = 520
    const height = 260
    const padding = 32
    const [isZoomed, setIsZoomed] = useState(false)
    const [hoverPoint, setHoverPoint] = useState<{ point: UserPoint; x: number; y: number } | null>(null)
    const [isTouch, setIsTouch] = useState(false)

    const xValues = points.map(p => p.bullishness)
    const yValues = points.map(p => p.points)
    const minX = isZoomed ? Math.max(0, percentile(xValues, 0.1)) : 0
    const maxX = isZoomed ? Math.min(100, percentile(xValues, 0.9)) : 100
    const minY = isZoomed ? Math.min(percentile(yValues, 0.1), 0) : Math.min(...yValues, 0)
    const maxY = isZoomed ? Math.max(percentile(yValues, 0.9), 0) : Math.max(...yValues, 0)
    const yRange = maxY - minY || 1

    const yToSvg = (value: number) => {
        const normalized = (value - minY) / yRange
        return height - padding - normalized * (height - padding * 2)
    }

    const xToSvg = (value: number) => {
        const range = maxX - minX || 1
        const normalized = (value - minX) / range
        return padding + normalized * (width - padding * 2)
    }

    const humanLine = getRegressionLine(humanPoints)
    const allLine = getRegressionLine(points)

    const lineX1 = minX
    const lineX2 = maxX

    return (
        <div className="w-full overflow-x-auto">
            <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-3 text-[12px] text-stone-500">
                    <span className="flex items-center gap-2">
                        <span className="inline-block w-4 h-0.5 bg-stone-400" />
                        All (incl. bots)
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-stone-800" />
                        Humans
                    </span>
                </div>
                <button
                    onClick={() => setIsZoomed(prev => !prev)}
                    className="text-xs text-stone-500 hover:text-stone-700"
                >
                    {isZoomed ? "Reset zoom" : "Zoom to humans"}
                </button>
            </div>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full min-w-[420px]"
                onTouchStart={() => setIsTouch(true)}
            >
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

                <text x={padding} y={height - 10} className="fill-stone-500 text-[14px]">{Math.round(minX)}%</text>
                <text x={width - padding - 16} y={height - 10} className="fill-stone-500 text-[14px]">{Math.round(maxX)}%</text>
                <text x={8} y={padding + 4} className="fill-stone-500 text-[14px]">{maxY}</text>
                <text x={8} y={height - padding} className="fill-stone-500 text-[14px]">{minY}</text>
                <text x={width / 2} y={height - 2} className="fill-stone-600 text-[14px]" textAnchor="middle">
                    Bullishness (Avg Bet %)
                </text>
                <text
                    x={10}
                    y={height / 2}
                    className="fill-stone-600 text-[14px]"
                    textAnchor="middle"
                    transform={`rotate(-90 10 ${height / 2})`}
                >
                    Total Points
                </text>

                {allLine && (
                    <line
                        x1={xToSvg(lineX1)}
                        y1={yToSvg(allLine.m * lineX1 + allLine.b)}
                        x2={xToSvg(lineX2)}
                        y2={yToSvg(allLine.m * lineX2 + allLine.b)}
                        stroke="#a8a29e"
                        strokeWidth="2"
                    />
                )}
                {humanLine && (
                    <line
                        x1={xToSvg(lineX1)}
                        y1={yToSvg(humanLine.m * lineX1 + humanLine.b)}
                        x2={xToSvg(lineX2)}
                        y2={yToSvg(humanLine.m * lineX2 + humanLine.b)}
                        stroke="#1c1917"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                    />
                )}

                {points.map(point => {
                    const x = xToSvg(point.bullishness)
                    const y = yToSvg(point.points)
                    const labelOnLeft = x > width - padding - 90
                    return (
                        <g
                            key={point.username}
                            onMouseEnter={() => setHoverPoint({ point, x, y })}
                            onMouseLeave={() => setHoverPoint(null)}
                            onTouchStart={(e) => {
                                e.preventDefault()
                                setHoverPoint({ point, x, y })
                                setIsTouch(true)
                            }}
                        >
                            <circle cx={x} cy={y} r={5} className="fill-stone-800" />
                            <circle
                                cx={x}
                                cy={y}
                                r={isTouch ? 14 : 8}
                                className="fill-transparent"
                                pointerEvents="all"
                            />
                            <text
                                x={labelOnLeft ? x - 12 : x + 12}
                                y={y + 4}
                                className="fill-stone-700 text-[11px]"
                                textAnchor={labelOnLeft ? "end" : "start"}
                            >
                                {point.username}
                            </text>
                        </g>
                    )
                })}
                {hoverPoint && (
                    (() => {
                        const label = `${hoverPoint.point.username}: ${hoverPoint.point.bullishness}% • ${hoverPoint.point.points}`
                        const labelWidth = Math.max(120, label.length * 6)
                        const labelHeight = 18
                        const xPos = Math.min(
                            Math.max(hoverPoint.x + 12, padding),
                            width - padding - labelWidth
                        )
                        const yPos = Math.max(hoverPoint.y - 24, padding)
                        return (
                            <g>
                                <rect
                                    x={xPos}
                                    y={yPos}
                                    width={labelWidth}
                                    height={labelHeight}
                                    rx={6}
                                    className="fill-stone-800"
                                    opacity={0.9}
                                />
                                <text
                                    x={xPos + 6}
                                    y={yPos + 12}
                                className="fill-white text-[12px]"
                            >
                                {label}
                            </text>
                            </g>
                        )
                    })()
                )}
            </svg>
        </div>
    )
}

function DensityPlot({
    values,
    binNames,
    showAxisLabels = false,
    showMeanLine = false
}: {
    values: number[]
    binNames: string[]
    showAxisLabels?: boolean
    showMeanLine?: boolean
}) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null)
    const buckets = new Array(10).fill(0)
    values.forEach(val => {
        const idx = Math.min(9, Math.floor(val / 10))
        buckets[idx] += 1
    })
    const max = Math.max(...buckets, 1)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const meanPosition = Math.min(9.99, Math.max(0, mean / 10))

    return (
        <div className="space-y-2">
            <div className="relative grid grid-cols-10 gap-1 h-16 items-end">
                {buckets.map((count, idx) => (
                    <div
                        key={idx}
                        className="relative group w-full h-full flex items-end"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onMouseLeave={() => setActiveIndex(null)}
                        onTouchStart={(e) => {
                            e.preventDefault()
                            setActiveIndex(prev => (prev === idx ? null : idx))
                        }}
                    >
                        <div
                            className={cn("rounded-sm bg-stone-200 w-full")}
                            style={{ height: `${Math.max(8, (count / max) * 100)}%` }}
                        />
                        <div
                            className={cn(
                                "pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-stone-800 text-white text-[12px] px-2 py-1 opacity-0 shadow group-hover:opacity-100",
                                activeIndex === idx && "opacity-100"
                            )}
                        >
                            {idx * 10}-{idx * 10 + 9}%: {binNames[idx] || "No bets"}
                        </div>
                    </div>
                ))}
                {showMeanLine && (
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-stone-500/70"
                        style={{ left: `${(meanPosition / 10) * 100}%` }}
                    />
                )}
            </div>
            {showAxisLabels && (
                <div className="grid grid-cols-10 gap-1 text-[12px] text-stone-500">
                    {Array.from({ length: 10 }).map((_, idx) => (
                        <span key={idx} className="text-center">{idx * 10}</span>
                    ))}
                </div>
            )}
            {showAxisLabels && (
                <div className="text-[14px] text-stone-600 text-center">Bet (%) distribution</div>
            )}
        </div>
    )
}

function standardDeviation(values: number[]) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
    return Math.sqrt(variance)
}

function buildCountLabels(values: number[]) {
    const bins = new Array(10).fill(0)
    values.forEach(value => {
        const idx = Math.min(9, Math.floor(value / 10))
        bins[idx] += 1
    })
    return bins.map(count => (count === 0 ? "" : `${count} bet${count === 1 ? "" : "s"}`))
}

function CategoryOutcomeChart({
    stats
}: {
    stats: { category: PredictionCategory; happened: number; notHappened: number; unknown: number }[]
}) {
    const width = 520
    const height = 220
    const padding = 36

    const values = stats.map(stat => {
        const total = stat.happened + stat.notHappened
        return total === 0 ? 0 : Math.round((stat.happened / total) * 100)
    })

    const yToSvg = (value: number) => {
        const normalized = value / 100
        return height - padding - normalized * (height - padding * 2)
    }

    const barWidth = (width - padding * 2) / stats.length

    return (
        <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[420px]">
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e7e5e4" />
                <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e7e5e4" />
                <text x={8} y={padding + 4} className="fill-stone-500 text-[14px]">100%</text>
                <text x={8} y={height - padding} className="fill-stone-500 text-[14px]">0%</text>
                <text x={width / 2} y={height - 6} className="fill-stone-600 text-[14px]" textAnchor="middle">
                    Likelihood Category
                </text>
                <text
                    x={10}
                    y={height / 2}
                    className="fill-stone-600 text-[14px]"
                    textAnchor="middle"
                    transform={`rotate(-90 10 ${height / 2})`}
                >
                    Percent Happened
                </text>

                {stats.map((stat, idx) => {
                    const value = values[idx]
                    const barX = padding + idx * barWidth + barWidth * 0.2
                    const barW = barWidth * 0.6
                    const barY = yToSvg(value)
                    const barH = height - padding - barY
                    return (
                        <g key={stat.category}>
                            <title>{`${CATEGORY_LABELS[stat.category]}: ${value}% happened`}</title>
                            <rect x={barX} y={barY} width={barW} height={barH} rx={6} className="fill-stone-800" />
                            <text x={barX + barW / 2} y={barY - 6} className="fill-stone-700 text-[14px]" textAnchor="middle">
                                {value}%
                            </text>
                            <text x={barX + barW / 2} y={height - padding + 14} className="fill-stone-600 text-[14px]" textAnchor="middle">
                                {CATEGORY_LABELS[stat.category]}
                            </text>
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

function percentile(values: number[], p: number) {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const idx = Math.floor((sorted.length - 1) * p)
    return sorted[idx]
}

function getRegressionLine(points: UserPoint[]) {
    if (points.length < 2) return null
    const xs = points.map(p => p.bullishness)
    const ys = points.map(p => p.points)
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length

    let num = 0
    let den = 0
    for (let i = 0; i < xs.length; i += 1) {
        num += (xs[i] - meanX) * (ys[i] - meanY)
        den += Math.pow(xs[i] - meanX, 2)
    }
    if (den === 0) return null
    const m = num / den
    const b = meanY - m * meanX
    return { m, b }
}
