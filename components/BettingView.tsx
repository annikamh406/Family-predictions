'use client'

import { useState, useEffect, useRef } from "react"
import { useUser } from "@/contexts/UserContext"
import { supabase } from "@/utils/supabase"
import { Button } from "./ui/Button"
import { Loader2, Save, Check, AlertCircle } from "lucide-react"
import {
    CATEGORY_LABELS,
    CATEGORY_COLORS,
    CATEGORY_BG_COLORS,
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

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function BettingView({ year }: { year: number }) {
    const { user } = useUser()
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [bets, setBets] = useState<Record<string, number>>({})
    const [status, setStatus] = useState<Record<string, SaveStatus>>({}) // Per-card status
    const [isLoading, setIsLoading] = useState(true)

    const timers = useRef<Record<string, NodeJS.Timeout>>({})

    useEffect(() => {
        fetchData()
        return () => {
            Object.values(timers.current).forEach(clearTimeout)
        }
    }, [])

    const fetchData = async () => {
        if (!user) return

        // Fetch predictions with usernames
        const { data: predsData } = await supabase
            .from('predictions')
            .select('*, user:users(username)')
            .eq('year', year)

        // Fetch existing bets
        const { data: betsData } = await supabase
            .from('bets')
            .select('*')
            .eq('user_id', user.id)

        if (predsData) {
            // @ts-expect-error Supabase types
            const rawPreds = predsData as Prediction[]
            setPredictions(sortPredictionsByCategory(rawPreds))
        }

        if (betsData) {
            const betsMap: Record<string, number> = {}
            betsData.forEach(b => {
                betsMap[b.prediction_id] = b.probability
            })
            setBets(betsMap)
        }
        setIsLoading(false)
    }

    const saveBet = async (predId: string, prob: number) => {
        if (!user) return
        setStatus(prev => ({ ...prev, [predId]: 'saving' }))

        try {
            const { error } = await supabase
                .from('bets')
                .upsert({
                    user_id: user.id,
                    prediction_id: predId,
                    probability: prob
                }, { onConflict: 'user_id,prediction_id' })

            if (error) throw error

            setStatus(prev => ({ ...prev, [predId]: 'saved' }))
            setTimeout(() => setStatus(prev => ({ ...prev, [predId]: 'idle' })), 2000)
        } catch (e) {
            console.error(e)
            setStatus(prev => ({ ...prev, [predId]: 'error' }))
        }
    }

    const handleSliderChange = (predictionId: string, val: number) => {
        setBets(prev => ({ ...prev, [predictionId]: val }))
        setStatus(prev => ({ ...prev, [predictionId]: 'idle' }))

        if (timers.current[predictionId]) clearTimeout(timers.current[predictionId])

        // Debounce 500ms for slider (faster than text)
        timers.current[predictionId] = setTimeout(() => {
            saveBet(predictionId, val)
        }, 500)
    }

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin w-6 h-6 mx-auto text-stone-300" /></div>

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-stone-800">Place Your Bets</h2>
                    <p className="text-stone-500">Rate the likelihood (0-100%). Saving automatically.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {predictions.map((pred) => (
                    <div
                        key={pred.id}
                        className={cn(
                            "group p-6 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md relative",
                            CATEGORY_BG_COLORS[pred.category]
                        )}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className={cn(
                                "text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider",
                                CATEGORY_COLORS[pred.category]
                            )}>
                                {pred.user?.username || 'Unknown'} &bull; {CATEGORY_LABELS[pred.category]}
                            </span>

                            {/* Status */}
                            <div className="h-6 flex items-center pl-2">
                                {status[pred.id] === 'saving' ? (
                                    <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
                                ) : status[pred.id] === 'saved' ? (
                                    <Check className="w-4 h-4 text-green-600 animate-in zoom-in" />
                                ) : status[pred.id] === 'error' ? (
                                    <AlertCircle className="w-4 h-4 text-rose-500" />
                                ) : (
                                    <span className="text-2xl font-bold text-stone-800 transition-all">
                                        {bets[pred.id] ?? 50}%
                                    </span>
                                )}
                            </div>
                        </div>

                        <p className="text-lg text-stone-800 leading-snug font-medium mb-6">
                            {pred.description}
                        </p>

                        <div className="pt-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={bets[pred.id] ?? 50}
                                onChange={(e) => handleSliderChange(pred.id, parseInt(e.target.value))}
                                className={cn(
                                    "w-full h-2 rounded-lg appearance-none cursor-pointer bg-black/10",
                                    "accent-stone-800 hover:accent-stone-600"
                                )}
                            />
                            <div className="flex justify-between text-[10px] text-stone-400 uppercase tracking-widest mt-1">
                                <span>Impossible</span>
                                <span>Certain</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-center text-xs text-stone-300 pt-8">
                Bets auto-saved
            </div>
        </div>
    )
}
