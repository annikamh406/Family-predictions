'use client'

import { useState, useEffect, useRef } from "react"
import { useUser } from "@/contexts/UserContext"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Sparkles, ChevronDown } from "lucide-react"
import { cn } from "@/utils/cn"
import { supabase } from "@/utils/supabase"

export function LoginForm() {
    const [username, setUsername] = useState("")
    const [selectedFamilyId, setSelectedFamilyId] = useState("guest")
    const { login, families } = useUser()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const nameInputRef = useRef<HTMLInputElement | null>(null)
    const [familyUsers, setFamilyUsers] = useState<string[]>([])
    const [suggestion, setSuggestion] = useState<{ input: string; match: string } | null>(null)
    const [ignoredSuggestionFor, setIgnoredSuggestionFor] = useState<string>("")

    // Auto-select first family when families load
    useEffect(() => {
        if (families.length > 0 && !selectedFamilyId) {
            setSelectedFamilyId("guest")
        }
    }, [families, selectedFamilyId])

    useEffect(() => {
        if (!selectedFamilyId || selectedFamilyId === "guest") {
            setFamilyUsers([])
            return
        }

        const loadUsers = async () => {
            const { data } = await supabase
                .from('users')
                .select('username')
                .eq('family_id', selectedFamilyId)

            if (data) {
                setFamilyUsers(data.map(u => u.username))
            } else {
                setFamilyUsers([])
            }
        }

        loadUsers()
    }, [selectedFamilyId])

    const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase()

    const findClosestName = (value: string) => {
        const normalized = normalizeName(value)
        if (!normalized) return null

        let best: { name: string; dist: number } | null = null
        for (const name of familyUsers) {
            const dist = levenshtein(normalized, normalizeName(name))
            if (best === null || dist < best.dist) {
                best = { name, dist }
            }
        }

        if (!best) return null
        const threshold = normalized.length > 8 ? 3 : 2
        return best.dist > 0 && best.dist <= threshold ? best.name : null
    }

    const performLogin = async (name: string) => {
        setIsLoading(true)
        setError("")

        const result = await login(name, selectedFamilyId)

        if (!result.success) {
            setError(result.error || "Login failed")
        }
        setIsLoading(false)
    }

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

        if (selectedFamilyId === "guest") {
            await performLogin(username)
            return
        }

        const normalized = normalizeName(username)
        const exactMatch = familyUsers.find(name => normalizeName(name) === normalized)
        if (exactMatch) {
            await performLogin(exactMatch)
            return
        }

        if (ignoredSuggestionFor !== normalized) {
            const match = findClosestName(username)
            if (match) {
                setSuggestion({ input: username, match })
                return
            }
        }

        await performLogin(username)
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
                    {suggestion && (
                        <div className="text-sm text-stone-600 bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2">
                            <div>Did you mean <strong>{suggestion.match}</strong>?</div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={async () => {
                                        setSuggestion(null)
                                        setUsername(suggestion.match)
                                        await performLogin(suggestion.match)
                                    }}
                                >
                                    Use {suggestion.match}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={async () => {
                                        setIgnoredSuggestionFor(normalizeName(suggestion.input))
                                        setSuggestion(null)
                                        await performLogin(suggestion.input)
                                    }}
                                >
                                    Continue as {suggestion.input}
                                </Button>
                            </div>
                        </div>
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

function levenshtein(a: string, b: string) {
    if (a === b) return 0
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length

    const rows = a.length + 1
    const cols = b.length + 1
    const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))

    for (let i = 0; i < rows; i += 1) matrix[i][0] = i
    for (let j = 0; j < cols; j += 1) matrix[0][j] = j

    for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            )
        }
    }

    return matrix[rows - 1][cols - 1]
}
