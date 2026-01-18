'use client'

import { useUser } from "@/contexts/UserContext"
import { LoginForm } from "@/components/LoginForm"
import { GameHome } from "@/components/GameHome"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { user, isLoading } = useUser()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-stone-300" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4 relative overflow-hidden">
        {/* Background Gradients - Subtle Pastel */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-rose-100/50 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-green-100/50 rounded-full blur-[120px] pointer-events-none" />

        <LoginForm />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 relative selection:bg-stone-200">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[120px] pointer-events-none" />
      <GameHome />
    </div>
  )
}
