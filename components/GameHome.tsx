'use client'

import { useState } from "react"
import { useUser } from "@/contexts/UserContext"
import { GameDashboard } from "./GameDashboard"
import { YearSelection } from "./YearSelection"
import { Button } from "./ui/Button"
import { LogOut, Users, Eye } from "lucide-react"
import { cn } from "@/utils/cn"
import { AdminPanel } from "./AdminPanel"
import { FamilyPinModal } from "./FamilyPinModal"

export function GameHome() {
    const { user, family, families, logout, viewingFamily, switchFamily, isViewingOtherFamily, isGuest } = useUser()
    const [selectedYear, setSelectedYear] = useState<number | null>(null)

    // Header for Year Selection checks user is logged in
    if (!selectedYear) {
        return (
            <div className="min-h-screen relative pb-10">
                {/* Top Bar */}
                <div className="absolute top-4 left-4 right-4 z-10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <FamilySwitcher
                            families={families}
                            currentFamily={family}
                            viewingFamily={viewingFamily}
                            onSwitch={switchFamily}
                        />
                        <div className="flex items-center gap-2">
                            <span className="text-stone-400 text-sm hidden md:inline">
                                {user?.username} {family?.name ? `(${family.name})` : ""}
                            </span>
                            <FamilyPinModal />
                            {!isGuest && <AdminPanel />}
                            <Button variant="ghost" size="sm" onClick={logout} className="p-2 text-stone-400 hover:text-red-500">
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

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
                        {family?.id && (
                            <button
                                onClick={() => switchFamily(family.id)}
                                className="underline hover:text-amber-900"
                            >
                                Back to {family.name}
                            </button>
                        )}
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
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-stone-200 shadow-sm max-w-full">
            <Users className="w-4 h-4 text-stone-400 shrink-0" />
            <select
                value={viewingFamily?.id || ""}
                onChange={(e) => onSwitch(e.target.value)}
                className={cn(
                    "h-8 px-2 rounded-full bg-white text-sm text-stone-600 border border-stone-200 max-w-[220px] sm:max-w-[320px]",
                    "focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                )}
            >
                {families.map(fam => (
                    <option key={fam.id} value={fam.id}>
                        {fam.name}
                    </option>
                ))}
            </select>
            {currentFamily?.id !== viewingFamily?.id && (
                <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-1 flex items-center gap-1 shrink-0">
                    <Eye className="w-3 h-3" /> Viewing
                </span>
            )}
        </div>
    )
}
