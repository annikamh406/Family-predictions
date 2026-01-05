'use client'

import { useState } from "react"
import { useUser } from "@/contexts/UserContext"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Sparkles } from "lucide-react"

export function LoginForm() {
    const [username, setUsername] = useState("")
    const { login } = useUser()
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!username.trim()) return

        setIsLoading(true)
        await login(username)
        setIsLoading(false)
    }

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
                        Enter your name to join the fun!
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
                    <Input
                        placeholder="Your Name (e.g., Mom, Dad, Annika)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isLoading}
                        className="text-center text-lg h-12"
                        autoFocus
                    />
                    <Button type="submit" size="lg" isLoading={isLoading} className="w-full">
                        Let's Play
                    </Button>
                </form>
            </div>
        </div>
    )
}
