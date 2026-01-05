'use client'

import { useUser } from "@/contexts/UserContext"
import { Button } from "./ui/Button"
import { LogOut, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/utils/supabase"
import { ForecastingView } from "./ForecastingView"
import { BettingView } from "./BettingView"
import { ResultsView } from "./ResultsView"
import { AdminControls } from "./AdminControls"

type GamePhase = 'forecasting' | 'betting' | 'results' | 'complete'
type GameYearRow = { year: number; status: GamePhase }

export function GameDashboard({ year, onBack }: { year: number, onBack: () => void }) {
    const { user, logout } = useUser()
    const [phase, setPhase] = useState<GamePhase | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchGameState()

        // Realtime subscription
        const channel = supabase
            .channel(`game_years_changes_${year}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'game_years',
                    filter: `year=eq.${year}`,
                },
                (payload) => {
                    const newStatus = (payload.new as GameYearRow).status
                    if (newStatus) {
                        setPhase(newStatus)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [year])

    async function fetchGameState() {
        const { data } = await supabase
            .from('game_years')
            .select('status')
            .eq('year', year)
            .single()

        if (data) {
            setPhase(data.status)
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24">
            <header className="flex justify-between items-center glass-panel p-4 sticky top-4 z-40 bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={onBack} className="text-stone-500 hover:text-stone-900">
                        ← Back
                    </Button>
                    <div>
                        <h2 className="text-lg font-bold text-stone-800">Predictions {year}</h2>
                        <span className="text-xs text-stone-400 font-medium">{user?.username}</span>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={logout} className="text-stone-400 hover:text-red-500">
                    <LogOut className="h-4 w-4" />
                </Button>
            </header>

            <main className="glass-panel p-6 md:p-8 min-h-[400px]">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-stone-300" />
                    </div>
                ) : phase === 'forecasting' ? (
                    <ForecastingView year={year} />
                ) : phase === 'betting' ? (
                    <BettingView year={year} />
                ) : phase === 'results' || phase === 'complete' ? (
                    <ResultsView year={year} isLocked={phase === 'complete'} />
                ) : (
                    <div className="text-center py-20 text-stone-400">
                        {`No active game found for ${year}`}
                    </div>
                )}
            </main>

            {phase && (
                <AdminControls
                    year={year}
                    currentPhase={phase}
                    onPhaseChange={setPhase}
                />
            )}
        </div>
    )
}
