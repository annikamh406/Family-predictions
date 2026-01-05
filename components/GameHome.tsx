'use client'

import { useState } from "react"
import { useUser } from "@/contexts/UserContext"
import { GameDashboard } from "./GameDashboard"
import { YearSelection } from "./YearSelection"
import { Button } from "./ui/Button"
import { LogOut } from "lucide-react"

export function GameHome() {
    const { user, logout } = useUser()
    const [selectedYear, setSelectedYear] = useState<number | null>(null)

    // Header for Year Selection checks user is logged in
    if (!selectedYear) {
        return (
            <div className="min-h-screen relative pb-10">
                <div className="absolute top-4 right-4 z-10">
                    <div className="flex items-center gap-4">
                        <span className="text-stone-400 text-sm hidden md:inline">Logged in as {user?.username}</span>
                        <Button variant="ghost" size="sm" onClick={logout} className="p-2 text-stone-400 hover:text-red-500">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <YearSelection onSelectYear={setSelectedYear} />
            </div>
        )
    }

    return (
        <GameDashboard year={selectedYear} onBack={() => setSelectedYear(null)} />
    )
}
