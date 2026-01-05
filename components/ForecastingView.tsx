'use client'

import { useState, useEffect, useRef } from "react"
import { useUser } from "@/contexts/UserContext"
import { supabase } from "@/utils/supabase"
import { Loader2, Check, AlertCircle, LayoutGrid, Table2 } from "lucide-react"
import { ForecastingSummary } from "./ForecastingSummary"
import {
    CATEGORY_LABELS,
    CATEGORY_BG_COLORS,
    CATEGORY_COLORS,
    PredictionCategory
} from "@/utils/predictions"
import { cn } from "@/utils/cn"

const CATEGORIES: PredictionCategory[] = ['highly_likely', 'mildly_likely', 'mildly_unlikely', 'highly_unlikely']

type PredictionRecord = {
    id: string
    category: PredictionCategory
    description: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function ForecastingView({ year }: { year: number }) {
    const { user } = useUser()
    const [viewMode, setViewMode] = useState<'cards' | 'summary'>('cards')
    const [predictions, setPredictions] = useState<Record<string, string>>({})
    const [originalPredictions, setOriginalPredictions] = useState<Record<string, PredictionRecord>>({})
    const [status, setStatus] = useState<Record<string, SaveStatus>>({})
    const [isLoading, setIsLoading] = useState(true)

    // Debounce timers
    const timers = useRef<Record<string, NodeJS.Timeout>>({})

    useEffect(() => {
        fetchPredictions()
        return () => {
            Object.values(timers.current).forEach(clearTimeout)
        }
    }, [])

    const fetchPredictions = async () => {
        if (!user) return
        const { data } = await supabase
            .from('predictions')
            .select('id, category, description')
            .eq('year', year)
            .eq('user_id', user.id)

        if (data) {
            const predsMap: Record<string, string> = {}
            const originalsMap: Record<string, PredictionRecord> = {}

            data.forEach((p: any) => {
                const cat = p.category as PredictionCategory
                predsMap[cat] = p.description
                originalsMap[cat] = {
                    id: p.id,
                    category: cat,
                    description: p.description
                }
            })
            setPredictions(predsMap)
            setOriginalPredictions(originalsMap)
        }
        setIsLoading(false)
    }

    const saveCategory = async (cat: PredictionCategory, newDesc: string) => {
        if (!user) return

        setStatus(prev => ({ ...prev, [cat]: 'saving' }))

        try {
            const original = originalPredictions[cat]

            if (original) {
                if (original.description !== newDesc) {
                    // 1. Reset Bets
                    await supabase.from('bets').delete().eq('prediction_id', original.id)

                    // 2. Update Prediction
                    const { error } = await supabase
                        .from('predictions')
                        .update({ description: newDesc })
                        .eq('id', original.id)

                    if (error) throw error

                    // Update original to match new state so next debounce doesn't re-save
                    setOriginalPredictions(prev => ({
                        ...prev,
                        [cat]: { ...original, description: newDesc }
                    }))
                }
            } else if (newDesc) {
                // Insert New
                const { data, error } = await supabase
                    .from('predictions')
                    .insert({
                        year,
                        user_id: user.id,
                        category: cat,
                        description: newDesc
                    })
                    .select()
                    .single()

                if (error) throw error

                if (data) {
                    setOriginalPredictions(prev => ({
                        ...prev,
                        [cat]: { id: data.id, category: cat, description: newDesc }
                    }))
                }
            }

            setStatus(prev => ({ ...prev, [cat]: 'saved' }))
            // Clear 'saved' message after 2s
            setTimeout(() => setStatus(prev => ({ ...prev, [cat]: 'idle' })), 2000)

        } catch (e) {
            console.error(e)
            setStatus(prev => ({ ...prev, [cat]: 'error' }))
        }
    }

    const handleChange = (cat: PredictionCategory, val: string) => {
        setPredictions(prev => ({ ...prev, [cat]: val }))
        setStatus(prev => ({ ...prev, [cat]: 'idle' })) // Clear previous status

        // Clear existing timer
        if (timers.current[cat]) clearTimeout(timers.current[cat])

        // Set new timer (Debounce 1000ms)
        timers.current[cat] = setTimeout(() => {
            saveCategory(cat, val.trim())
        }, 1000)
    }

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin w-6 h-6 mx-auto text-stone-300" /></div>

    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <div className="flex justify-between items-center max-w-2xl mx-auto">
                    <h1 className="text-3xl font-bold text-stone-800">Your {year} Forecast</h1>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                    <button
                        onClick={() => setViewMode('cards')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                            viewMode === 'cards' ? "bg-stone-800 text-white shadow-md" : "bg-white text-stone-500 hover:bg-stone-50"
                        )}
                    >
                        <LayoutGrid className="w-4 h-4" /> Cards
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
                </div>
                <p className="text-stone-500 max-w-lg mx-auto text-sm pt-2">
                    {viewMode === 'cards' ? "Make 4 bold predictions. Changes save automatically." : "View everyone's predictions."}
                </p>
            </div>

            {viewMode === 'summary' ? (
                <ForecastingSummary year={year} />
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {CATEGORIES.map((cat) => (
                        <div
                            key={cat}
                            className={cn(
                                "group p-6 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md relative",
                                CATEGORY_BG_COLORS[cat]
                            )}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                                    CATEGORY_COLORS[cat]
                                )}>
                                    {CATEGORY_LABELS[cat]}
                                </span>

                                {/* Status Indicator */}
                                <div className="h-6 flex items-center">
                                    {status[cat] === 'saving' && (
                                        <span className="text-xs text-stone-400 flex items-center animate-pulse">
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...
                                        </span>
                                    )}
                                    {status[cat] === 'saved' && (
                                        <span className="text-xs text-green-600 flex items-center font-medium animate-in fade-in slide-in-from-bottom-2">
                                            <Check className="w-3 h-3 mr-1" /> Saved
                                        </span>
                                    )}
                                    {status[cat] === 'error' && (
                                        <span className="text-xs text-red-500 flex items-center font-medium">
                                            <AlertCircle className="w-3 h-3 mr-1" /> Error
                                        </span>
                                    )}
                                </div>
                            </div>
                            <textarea
                                value={predictions[cat] || ''}
                                onChange={(e) => handleChange(cat, e.target.value)}
                                placeholder={`Enter your ${CATEGORY_LABELS[cat].toLowerCase()} prediction...`}
                                className="w-full bg-white/50 border-0 rounded-xl p-4 text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-black/5 resize-none h-24 text-lg leading-relaxed shadow-inner"
                            />
                        </div>
                    ))}
                </div>
            )}

            <div className="text-center text-xs text-stone-300 pt-8">
                All changes saved to cloud automatically
            </div>
        </div>
    )
}
