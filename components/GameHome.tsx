'use client'

import { useState } from "react"
import { useUser } from "@/contexts/UserContext"
import { GameDashboard } from "./GameDashboard"
import { YearSelection } from "./YearSelection"
import { Button } from "./ui/Button"
import { LogOut, Users, Eye } from "lucide-react"
import { cn } from "@/utils/cn"
import { AdminPanel } from "./AdminPanel"

export function GameHome() {
    const { user, family, families, logout, viewingFamily, switchFamily, isViewingOtherFamily } = useUser()
    const [selectedYear, setSelectedYear] = useState<number | null>(null)

    // Header for Year Selection checks user is logged in
    if (!selectedYear) {
        return (
            <div className="min-h-screen relative pb-10">
                {/* Top Bar */}
                <div className="absolute top-4 right-4 z-10">
                    <div className="flex items-center gap-4">
                        <span className="text-stone-400 text-sm hidden md:inline">
                            {user?.username} ({family?.name})
                        </span>
                        <AdminPanel />
                        <Button variant="ghost" size="sm" onClick={logout} className="p-2 text-stone-400 hover:text-red-500">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Family Switcher */}
                <FamilySwitcher
                    families={families}
                    currentFamily={family}
                    viewingFamily={viewingFamily}
                    onSwitch={switchFamily}
                />

                <YearSelection onSelectYear={setSelectedYear} />
            </div>
        )
    }

    return (
        <>
            {/* Viewing Other Family Banner */}
            {isViewingOtherFamily && viewingFamily && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
                    <span className="text-amber-800 text-sm font-medium flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4" />
                        Viewing {viewingFamily.name}'s predictions (read-only)
                        <button
                            onClick={() => switchFamily(family?.id || '')}
                            className="underline hover:text-amber-900"
                        >
                            Back to {family?.name}
                        </button>
                    </span>
                </div>
            )}

            <GameDashboard year={selectedYear} onBack={() => setSelectedYear(null)} />
        </>
    )
}

function FamilySwitcher({
    families,
    currentFamily,
    viewingFamily,
    onSwitch
}: {
    families: { id: string; name: string }[]
    currentFamily: { id: string; name: string } | null
    viewingFamily: { id: string; name: string } | null
    onSwitch: (id: string) => void
}) {
    if (families.length <= 1) return null

    return (
        <div className="absolute top-4 left-4 z-10">
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-stone-200 shadow-sm">
                <Users className="w-4 h-4 text-stone-400" />
                <div className="flex gap-1">
                    {families.map(fam => (
                        <button
                            key={fam.id}
                            onClick={() => onSwitch(fam.id)}
                            className={cn(
                                "px-3 py-1 rounded-full text-sm font-medium transition-all",
                                viewingFamily?.id === fam.id
                                    ? "bg-stone-800 text-white"
                                    : "text-stone-500 hover:bg-stone-100",
                                currentFamily?.id !== fam.id && viewingFamily?.id === fam.id && "bg-amber-100 text-amber-800"
                            )}
                        >
                            {fam.name.split('-')[0]}
                            {currentFamily?.id !== fam.id && viewingFamily?.id === fam.id && (
                                <Eye className="w-3 h-3 inline ml-1" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
