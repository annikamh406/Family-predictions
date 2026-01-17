'use client'

import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/utils/cn"

export function CrowdToggle() {
    const router = useRouter()
    const pathname = usePathname()
    const isCrowd = pathname.startsWith('/crowd')

    return (
        <div className="inline-flex items-center rounded-full border border-stone-200 bg-white p-1 shadow-sm">
            <button
                onClick={() => router.push('/')}
                className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                    !isCrowd ? "bg-stone-800 text-white" : "text-stone-500 hover:text-stone-700"
                )}
            >
                Family Predictions
            </button>
            <button
                onClick={() => router.push('/crowd')}
                className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                    isCrowd ? "bg-stone-800 text-white" : "text-stone-500 hover:text-stone-700"
                )}
            >
                Crowd Forecasting
            </button>
        </div>
    )
}
