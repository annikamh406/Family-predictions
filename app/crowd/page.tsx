'use client'

import { useUser } from "@/contexts/UserContext"
import { CrowdForecasting } from "@/components/CrowdForecasting"
import { Button } from "@/components/ui/Button"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function CrowdPage() {
    const { user, isLoading } = useUser()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && !user) {
            router.replace("/")
        }
    }, [isLoading, user, router])

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-50">
                <div className="text-stone-400">Loading…</div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
                <div className="glass-panel p-6 text-center space-y-4">
                    <div className="text-lg font-semibold text-stone-800">Redirecting to login…</div>
                    <p className="text-sm text-stone-500">
                        Please choose a family and log in to access crowd forecasting.
                    </p>
                    <Button onClick={() => router.replace("/")}>Go to Login</Button>
                </div>
            </div>
        )
    }

    return <CrowdForecasting />
}
