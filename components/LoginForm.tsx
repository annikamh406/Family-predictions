'use client'

import { useState, useEffect, useRef } from "react"
import { useUser } from "@/contexts/UserContext"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Sparkles, ChevronDown } from "lucide-react"
import { cn } from "@/utils/cn"

export function LoginForm() {
    const [username, setUsername] = useState("")
    const [selectedFamilyId, setSelectedFamilyId] = useState("guest")
    const { login, families } = useUser()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const nameInputRef = useRef<HTMLInputElement | null>(null)

    // Auto-select first family when families load
    useEffect(() => {
        if (families.length > 0 && !selectedFamilyId) {
            setSelectedFamilyId("guest")
        }
    }, [families, selectedFamilyId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedFamilyId) {
            setError("Please select a family")
            return
        }
        if (selectedFamilyId !== "guest" && !username.trim()) {
            setError("Please enter your name")
            return
        }

        setIsLoading(true)
        setError("")

        const result = await login(username, selectedFamilyId)

        if (!result.success) {
            setError(result.error || "Login failed")
        }
        setIsLoading(false)
    }

    const selectedFamily = families.find(f => f.id === selectedFamilyId)

    return (
        <div className="w-full max-w-md p-8 glass-panel animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col items-center gap-6 text-center">
                <div className="p-4 bg-stone-100 rounded-full">
                    <Sparkles className="h-8 w-8 text-stone-600" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-stone-800">
                        Family Predictions
                    </h1>
                    <p className="text-stone-500">
                        Select your family and enter your name to join!
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
                    {/* Family Dropdown */}
                    <div className="relative">
                        <select
                            value={selectedFamilyId}
                            onChange={(e) => setSelectedFamilyId(e.target.value)}
                            disabled={isLoading || families.length === 0}
                            className={cn(
                                "w-full h-12 px-4 pr-10 rounded-xl border border-stone-200 bg-white",
                                "text-center text-lg font-medium text-stone-800",
                                "appearance-none cursor-pointer",
                                "focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {families.length === 0 ? (
                                <option value="">Loading families...</option>
                            ) : (
                                <>
                                    <option value="guest">Login as guest (view-only)</option>
                                    {families.map(fam => (
                                        <option key={fam.id} value={fam.id}>
                                            {fam.name}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none" />
                    </div>

                    {/* Name Input */}
                    <div
                        onClick={() => nameInputRef.current?.focus()}
                        className="cursor-text"
                    >
                        <Input
                            ref={nameInputRef}
                            placeholder={selectedFamilyId === "guest" ? "Guest mode (no name needed)" : "Your Name (e.g., Mom, Dad, Annika)"}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading || selectedFamilyId === "guest"}
                            className="text-center text-lg h-12"
                            autoFocus
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <p className="text-red-500 text-sm animate-in fade-in">{error}</p>
                    )}

                    <Button type="submit" size="lg" isLoading={isLoading} className="w-full">
                        Let's Play
                    </Button>
                </form>

                {selectedFamilyId === "guest" ? (
                    <p className="text-xs text-stone-400">
                        Viewing all families (read-only)
                    </p>
                ) : selectedFamily ? (
                    <p className="text-xs text-stone-400">
                        Joining the {selectedFamily.name} family
                    </p>
                ) : null}
            </div>
        </div>
    )
}
