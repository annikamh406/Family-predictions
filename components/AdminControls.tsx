'use client'

import { useState } from "react"
import { supabase } from "@/utils/supabase"
import { Button } from "./ui/Button"
import { Settings, X } from "lucide-react"
import { generateBotBets } from "@/utils/bots"

type GamePhase = 'forecasting' | 'betting' | 'results' | 'complete'

export function AdminControls({ year, currentPhase, onPhaseChange, familyId, familyPin }: {
    year: number
    currentPhase: GamePhase
    onPhaseChange: (p: GamePhase) => void
    familyId: string
    familyPin: string
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handlePhaseChange = async (newPhase: GamePhase) => {
        if (newPhase === currentPhase) return

        const pin = prompt(`Enter Family PIN to switch to ${newPhase}:`)
        if (pin !== familyPin) {
            alert("Incorrect PIN")
            return
        }

        setLoading(true)

        // Trigger Bots if switching TO results
        if (newPhase === 'results') {
            try {
                await generateBotBets(year, familyId)
            } catch (e) {
                console.error("Bot generation failed", e)
                alert("Warning: Bot generation failed, but proceeding with phase change.")
            }
        }

        const { error } = await supabase
            .from('game_years')
            .update({ status: newPhase })
            .eq('year', year)
            .eq('family_id', familyId)

        if (error) {
            console.error(error)
            alert('Failed to update phase')
        } else {
            onPhaseChange(newPhase)
            setIsOpen(false)
        }
        setLoading(false)
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 rounded-full bg-stone-800 hover:bg-stone-700 text-white shadow-xl transition-all hover:scale-110 z-50"
            >
                <Settings className="w-6 h-6" />
            </button>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-stone-900/20 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-800"
                >
                    <X className="w-5 h-5" />
                </button>

                <div>
                    <h3 className="text-xl font-bold text-stone-800">Family Admin ({year})</h3>
                    <p className="text-stone-500 text-sm">Manage game phases for your family.</p>
                </div>

                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant={currentPhase === 'forecasting' ? 'primary' : 'secondary'}
                            onClick={() => handlePhaseChange('forecasting')}
                            isLoading={loading}
                            className="w-full justify-start"
                        >
                            📝 Forecasting
                        </Button>
                        <Button
                            variant={currentPhase === 'betting' ? 'primary' : 'secondary'}
                            onClick={() => handlePhaseChange('betting')}
                            isLoading={loading}
                            className="w-full justify-start"
                        >
                            💰 Betting
                        </Button>
                        <Button
                            variant={currentPhase === 'results' ? 'primary' : 'secondary'}
                            onClick={() => handlePhaseChange('results')}
                            isLoading={loading}
                            className="w-full justify-start"
                        >
                            🏆 Results
                        </Button>
                        <Button
                            variant={currentPhase === 'complete' ? 'primary' : 'secondary'}
                            onClick={() => handlePhaseChange('complete')}
                            isLoading={loading}
                            className="w-full justify-start"
                        >
                            🔒 Complete
                        </Button>
                    </div>
                </div>

                <div className="pt-4 border-t border-stone-100">
                    <p className="text-xs text-stone-400 text-center">
                        Changes affect all family members immediately.
                    </p>
                </div>
            </div>
        </div>
    )
}
