'use client'

import { useState } from "react"
import { KeyRound, X } from "lucide-react"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { useUser } from "@/contexts/UserContext"
import { supabase } from "@/utils/supabase"

export function FamilyPinModal() {
    const { family, refreshFamilies, isGuest } = useUser()
    const [isOpen, setIsOpen] = useState(false)
    const [currentPin, setCurrentPin] = useState("")
    const [newPin, setNewPin] = useState("")
    const [confirmPin, setConfirmPin] = useState("")
    const [error, setError] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    if (!family || isGuest) return null

    const handleSave = async () => {
        if (currentPin !== family.pin) {
            setError("Current PIN is incorrect")
            return
        }
        if (!newPin.trim()) {
            setError("New PIN cannot be empty")
            return
        }
        if (newPin !== confirmPin) {
            setError("New PINs do not match")
            return
        }

        setIsSaving(true)
        const { error: updateError } = await supabase
            .from('families')
            .update({ pin: newPin })
            .eq('id', family.id)

        if (updateError) {
            setError(updateError.message)
        } else {
            await refreshFamilies()
            setIsOpen(false)
            setCurrentPin("")
            setNewPin("")
            setConfirmPin("")
            setError("")
        }
        setIsSaving(false)
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="p-2 rounded-full bg-white/80 border border-stone-200 text-stone-500 hover:text-stone-700 hover:bg-stone-100"
                aria-label="Change family PIN"
            >
                <KeyRound className="w-4 h-4" />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-stone-900/20 backdrop-blur-sm animate-in fade-in overflow-auto">
                    <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-800"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <h3 className="text-lg font-bold text-stone-800">Change Family PIN</h3>
                            <p className="text-sm text-stone-500">{family.name}</p>
                        </div>

                        <div className="space-y-3">
                            <Input
                                placeholder="Current PIN"
                                value={currentPin}
                                onChange={(e) => setCurrentPin(e.target.value)}
                            />
                            <Input
                                placeholder="New PIN"
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value)}
                            />
                            <Input
                                placeholder="Confirm New PIN"
                                value={confirmPin}
                                onChange={(e) => setConfirmPin(e.target.value)}
                            />
                            {error && <p className="text-sm text-rose-500">{error}</p>}
                        </div>

                        <div className="pt-2 flex justify-end">
                            <Button onClick={handleSave} size="sm" isLoading={isSaving}>
                                Save PIN
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
