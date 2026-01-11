'use client'

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase"
import { useUser } from "@/contexts/UserContext"
import { Button } from "./ui/Button"
import { Loader2, Calendar, Plus, Trash2, Eye } from "lucide-react"
import { cn } from "@/utils/cn"

type GameYearRow = { year: number; status: string; family_id: string }

export function YearSelection({ onSelectYear }: { onSelectYear: (year: number) => void }) {
    const { viewingFamily, family, isViewingOtherFamily } = useUser()
    const [years, setYears] = useState<GameYearRow[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        if (viewingFamily) {
            fetchYears()
        }
    }, [viewingFamily])

    const fetchYears = async () => {
        if (!viewingFamily) return

        setLoading(true)
        const { data } = await supabase
            .from('game_years')
            .select('*')
            .eq('family_id', viewingFamily.id)
            .order('year', { ascending: false })

        if (data) {
            setYears(data.sort((a, b) => b.year - a.year))
        }
        setLoading(false)
    }

    const handleCreateYear = async () => {
        if (!family || isViewingOtherFamily) {
            alert("You can only create years for your own family")
            return
        }

        const newYear = prompt("Enter the year to create (e.g., 2027):")
        if (!newYear) return

        const yearInt = parseInt(newYear)
        if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
            alert("Please enter a valid year")
            return
        }

        if (years.some(y => y.year === yearInt)) {
            alert("Year already exists!")
            return
        }

        // Family admin PIN check
        const pin = prompt(`Enter Family PIN for ${family.name}:`)
        if (pin !== family.pin) {
            alert("Incorrect PIN")
            return
        }

        setCreating(true)
        const { error } = await supabase
            .from('game_years')
            .insert([{ year: yearInt, status: 'forecasting', family_id: family.id }])

        if (error) {
            console.error(error)
            alert("Failed to create year")
        } else {
            await fetchYears()
        }
        setCreating(false)
    }

    const handleDeleteYear = async (e: React.MouseEvent, yearToDelete: number) => {
        e.stopPropagation()

        if (isViewingOtherFamily) {
            alert("You can only delete years from your own family")
            return
        }

        const confirm1 = confirm(`⚠️ DANGER ZONE ⚠️\n\nAre you sure you want to delete the year ${yearToDelete}?\n\nThis will PERMANENTLY DELETE all predictions, bets, and scores for this year.\n\nThis action cannot be undone.`)
        if (!confirm1) return

        const confirm2 = confirm(`Final Confirmation:\n\nReally delete ${yearToDelete}?`)
        if (!confirm2) return

        // Overall admin PIN for destructive actions
        const pin = prompt("Enter Overall Admin PIN to confirm deletion:")
        if (pin !== "2647") {
            alert("Incorrect PIN")
            return
        }

        setLoading(true)
        const { error } = await supabase
            .from('game_years')
            .delete()
            .eq('year', yearToDelete)
            .eq('family_id', family?.id)

        if (error) {
            console.error(error)
            alert("Failed to delete year")
        } else {
            await fetchYears()
        }
        setLoading(false)
    }

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin w-6 h-6 mx-auto text-stone-300" /></div>

    return (
        <div className="max-w-4xl mx-auto space-y-12 py-12 animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-4">
                <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-sky-100 to-purple-100 rounded-3xl flex items-center justify-center border border-white/50 shadow-sm">
                    <Calendar className="w-10 h-10 text-stone-600" />
                </div>
                <h1 className="text-4xl font-bold text-stone-800">
                    {viewingFamily?.name || 'Select a Year'}
                </h1>
                <p className="text-stone-500 max-w-md mx-auto">
                    {isViewingOtherFamily ? (
                        <span className="flex items-center justify-center gap-2 text-amber-600">
                            <Eye className="w-4 h-4" /> Viewing another family's years (read-only)
                        </span>
                    ) : (
                        "Select a year to view predictions or start a new game."
                    )}
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
                {years.map((y) => (
                    <button
                        key={y.year}
                        onClick={() => onSelectYear(y.year)}
                        className="group relative p-6 glass-panel hover:bg-white text-left overflow-hidden"
                    >
                        {!isViewingOtherFamily && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <div
                                    role="button"
                                    onClick={(e) => handleDeleteYear(e, y.year)}
                                    className="p-2 hover:bg-red-50 rounded-full text-stone-300 hover:text-red-400 transition-colors"
                                    title="Delete Year"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </div>
                            </div>
                        )}

                        <div className="text-3xl font-bold text-stone-800 mb-2">{y.year}</div>
                        <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full",
                                y.status === 'forecasting' ? "bg-orange-400" :
                                    y.status === 'betting' ? "bg-purple-400" :
                                        y.status === 'results' ? "bg-green-400" : "bg-stone-300"
                            )} />
                            <span className="text-xs uppercase tracking-wider text-stone-400">{y.status}</span>
                        </div>
                    </button>
                ))}

                {years.length === 0 && (
                    <div className="col-span-full text-center py-12 text-stone-400">
                        {isViewingOtherFamily
                            ? `${viewingFamily?.name} hasn't created any years yet.`
                            : "No years yet. Create one to get started!"
                        }
                    </div>
                )}

                {!isViewingOtherFamily && (
                    <button
                        onClick={handleCreateYear}
                        disabled={creating}
                        className="group flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-stone-300 hover:border-stone-400 hover:bg-stone-50 transition-all text-stone-400 hover:text-stone-600"
                    >
                        <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">New Year</span>
                    </button>
                )}
            </div>
        </div>
    )
}
