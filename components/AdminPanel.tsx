'use client'

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/utils/supabase"
import { useUser } from "@/contexts/UserContext"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { cn } from "@/utils/cn"
import { Settings, X, Users, UserPlus, Trash2, Save, KeyRound } from "lucide-react"

type FamilyRow = {
    id: string
    name: string
    pin: string
}

type UserRow = {
    id: string
    username: string
    pin: string | null
    family_id: string | null
}

type UserYearEntry = {
    year: number
    hasSource: boolean
    hasTarget: boolean
}

export function AdminPanel() {
    const { families, family, refreshFamilies, adminPin, updateAdminPin, refreshAdminPin } = useUser()
    const [isOpen, setIsOpen] = useState(false)
    const [isVerified, setIsVerified] = useState(false)
    const [pinAttempt, setPinAttempt] = useState("")
    const [pinError, setPinError] = useState("")
    const [newAdminPin, setNewAdminPin] = useState("")
    const [selectedFamilyId, setSelectedFamilyId] = useState("")
    const [familyEdits, setFamilyEdits] = useState<Record<string, { name: string; pin: string }>>({})
    const [hasInitializedFamilies, setHasInitializedFamilies] = useState(false)
    const [userEdits, setUserEdits] = useState<Record<string, { username: string; pin: string }>>({})
    const [users, setUsers] = useState<UserRow[]>([])
    const [isLoadingUsers, setIsLoadingUsers] = useState(false)
    const [newFamilyName, setNewFamilyName] = useState("")
    const [newFamilyPin, setNewFamilyPin] = useState("")
    const [newUserName, setNewUserName] = useState("")
    const [newUserPin, setNewUserPin] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [mergeSourceId, setMergeSourceId] = useState("")
    const [mergeTargetId, setMergeTargetId] = useState("")
    const [mergeSelections, setMergeSelections] = useState<Record<number, "source" | "target" | null>>({})
    const [mergeOptions, setMergeOptions] = useState<UserYearEntry[]>([])
    const [yearOptions, setYearOptions] = useState<number[]>([])
    const [removeUserId, setRemoveUserId] = useState("")
    const [removeYear, setRemoveYear] = useState<number | "">("")

    const hasUnsavedChanges = useMemo(() => {
        const familyDirty = families.some(fam => {
            const edit = familyEdits[fam.id]
            if (!edit) return false
            return edit.name.trim() !== fam.name || edit.pin !== fam.pin
        })

        const userDirty = users.some(user => {
            const edit = userEdits[user.id]
            if (!edit) return false
            const currentPin = user.pin || ""
            return edit.username.trim() !== user.username || edit.pin !== currentPin
        })

        const mergeDirty = Boolean(
            mergeSourceId ||
            mergeTargetId ||
            Object.values(mergeSelections).some(selection => selection !== null)
        )

        return (
            familyDirty ||
            userDirty ||
            newFamilyName.trim() !== "" ||
            newFamilyPin.trim() !== "" ||
            newUserName.trim() !== "" ||
            newUserPin.trim() !== "" ||
            newAdminPin.trim() !== "" ||
            mergeDirty
        )
    }, [
        families,
        familyEdits,
        users,
        userEdits,
        newFamilyName,
        newFamilyPin,
        newUserName,
        newUserPin,
        newAdminPin,
        mergeSourceId,
        mergeTargetId,
        mergeSelections
    ])

    const resetPanelState = () => {
        setIsOpen(false)
        setIsVerified(false)
        setPinAttempt("")
        setPinError("")
        setNewAdminPin("")
        setNewFamilyName("")
        setNewFamilyPin("")
        setNewUserName("")
        setNewUserPin("")
        setSelectedFamilyId("")
        setUsers([])
        setUserEdits({})
        setFamilyEdits({})
        setMergeSourceId("")
        setMergeTargetId("")
        setMergeSelections({})
        setMergeOptions([])
        setYearOptions([])
        setRemoveUserId("")
        setRemoveYear("")
    }

    const handleClose = () => {
        if (!isVerified) {
            resetPanelState()
            return
        }
        if (hasUnsavedChanges) {
            const ok = confirm("You have unsaved changes. Discard them and close?")
            if (!ok) return
        }
        resetPanelState()
    }

    useEffect(() => {
        if (isOpen) {
            refreshFamilies()
            refreshAdminPin()
        }
    }, [isOpen, refreshFamilies, refreshAdminPin])

    useEffect(() => {
        if (!selectedFamilyId) {
            setSelectedFamilyId(family?.id || families[0]?.id || "")
        }
    }, [family, families, selectedFamilyId])

    useEffect(() => {
        if (!isOpen) {
            setHasInitializedFamilies(false)
            return
        }
        if (families.length === 0) return

        setFamilyEdits(prev => {
            const next = { ...prev }
            families.forEach(fam => {
                if (!next[fam.id]) {
                    next[fam.id] = { name: fam.name, pin: fam.pin }
                }
            })
            return next
        })

        if (!hasInitializedFamilies) {
            setHasInitializedFamilies(true)
        }
    }, [families, isOpen, hasInitializedFamilies])

    useEffect(() => {
        if (!isOpen || !selectedFamilyId) return
        fetchUsers(selectedFamilyId)
        fetchYears(selectedFamilyId)
    }, [isOpen, selectedFamilyId])

    useEffect(() => {
        if (!isOpen || !selectedFamilyId || !mergeSourceId) {
            setMergeOptions([])
            return
        }

        if (mergeSourceId === mergeTargetId) {
            setMergeOptions([])
            return
        }

        fetchMergeOptions(mergeSourceId, mergeTargetId, selectedFamilyId)
    }, [isOpen, mergeSourceId, mergeTargetId, selectedFamilyId])

    const familyOptions = useMemo(() => families.map(fam => ({
        id: fam.id,
        label: fam.name
    })), [families])

    const fetchUsers = async (familyId: string) => {
        setIsLoadingUsers(true)
        const { data } = await supabase
            .from('users')
            .select('id, username, pin, family_id')
            .eq('family_id', familyId)
            .order('username')

        if (data) {
            setUsers(data as UserRow[])
            const nextEdits: Record<string, { username: string; pin: string }> = {}
            data.forEach(user => {
                nextEdits[user.id] = { username: user.username, pin: user.pin || "" }
            })
            setUserEdits(nextEdits)
        } else {
            setUsers([])
            setUserEdits({})
        }
        setIsLoadingUsers(false)
    }

    const fetchYears = async (familyId: string) => {
        const { data } = await supabase
            .from('game_years')
            .select('year')
            .eq('family_id', familyId)
            .order('year', { ascending: false })

        if (data) {
            setYearOptions(data.map(row => row.year))
        } else {
            setYearOptions([])
        }
    }

    const fetchUserYears = async (userId: string, familyId: string) => {
        const years = new Set<number>()

        const { data: predYears } = await supabase
            .from('predictions')
            .select('year')
            .eq('user_id', userId)
            .eq('family_id', familyId)

        predYears?.forEach(row => years.add(row.year))

        const { data: betYears } = await supabase
            .from('bets')
            .select('prediction:predictions(year, family_id)')
            .eq('user_id', userId)

        betYears?.forEach((row: any) => {
            const prediction = row.prediction
            if (prediction?.family_id === familyId) {
                years.add(prediction.year)
            }
        })

        return years
    }

    const fetchMergeOptions = async (sourceId: string, targetId: string, familyId: string) => {
        const [sourceYears, targetYears] = await Promise.all([
            fetchUserYears(sourceId, familyId),
            targetId ? fetchUserYears(targetId, familyId) : Promise.resolve(new Set<number>())
        ])

        const allYears = new Set<number>()
        sourceYears.forEach(year => allYears.add(year))
        targetYears.forEach(year => allYears.add(year))

        const entries = Array.from(allYears)
            .sort((a, b) => b - a)
            .map(year => ({
                year,
                hasSource: sourceYears.has(year),
                hasTarget: targetYears.has(year)
            }))

        setMergeOptions(entries)
        setMergeSelections(prev => {
            const next = { ...prev }
            entries.forEach(({ year }) => {
                if (next[year] === undefined) {
                    next[year] = null
                }
            })
            entries.forEach(({ year, hasSource, hasTarget }) => {
                if (next[year] === "source" && !hasSource) {
                    next[year] = null
                }
                if (next[year] === "target" && !hasTarget) {
                    next[year] = null
                }
            })
            return next
        })
    }

    const handleFamilySave = async (familyId: string) => {
        const edit = familyEdits[familyId]
        if (!edit) return

        setIsSaving(true)
        const { error } = await supabase
            .from('families')
            .update({ name: edit.name.trim(), pin: edit.pin })
            .eq('id', familyId)

        if (error) {
            alert(`Failed to update family: ${error.message}`)
        } else {
            await refreshFamilies()
            setFamilyEdits(prev => ({
                ...prev,
                [familyId]: { name: edit.name.trim(), pin: edit.pin }
            }))
        }
        setIsSaving(false)
    }

    const handleFamilyAdd = async () => {
        if (!newFamilyName.trim() || !newFamilyPin.trim()) {
            alert("Enter a family name and PIN")
            return
        }

        setIsSaving(true)
        const { error } = await supabase
            .from('families')
            .insert([{ name: newFamilyName.trim(), pin: newFamilyPin.trim() }])

        if (error) {
            alert(`Failed to create family: ${error.message}`)
        } else {
            setNewFamilyName("")
            setNewFamilyPin("")
            await refreshFamilies()
        }
        setIsSaving(false)
    }

    const handleFamilyDelete = async (familyId: string) => {
        const target = families.find(f => f.id === familyId)
        const ok = confirm(`Delete family "${target?.name}"? This deletes all years, predictions, bets, and users for this family.`)
        if (!ok) return
        const pin = prompt("Enter admin PIN to confirm deletion:")
        if (pin !== adminPin) {
            alert("Incorrect admin PIN")
            return
        }
        const okFinal = confirm(`Final confirmation: delete "${target?.name}"?`)
        if (!okFinal) return

        setIsSaving(true)
        const { data: familyUsers } = await supabase
            .from('users')
            .select('id')
            .eq('family_id', familyId)

        const userIds = familyUsers?.map(u => u.id) || []

        if (userIds.length > 0) {
            await supabase.from('bets').delete().in('user_id', userIds)
        }

        await supabase.from('game_years').delete().eq('family_id', familyId)
        await supabase.from('users').delete().eq('family_id', familyId)
        const { error } = await supabase.from('families').delete().eq('id', familyId)

        if (error) {
            alert(`Failed to delete family: ${error.message}`)
        } else {
            await refreshFamilies()
            if (selectedFamilyId === familyId) {
                setSelectedFamilyId("")
            }
        }
        setIsSaving(false)
    }

    const handleUserSave = async (userId: string) => {
        const edit = userEdits[userId]
        if (!edit) return

        setIsSaving(true)
        const { error } = await supabase
            .from('users')
            .update({ username: edit.username.trim(), pin: edit.pin.trim() || null })
            .eq('id', userId)

        if (error) {
            alert(`Failed to update user: ${error.message}`)
        } else {
            await fetchUsers(selectedFamilyId)
        }
        setIsSaving(false)
    }

    const handleUserAdd = async () => {
        if (!newUserName.trim()) {
            alert("Enter a name")
            return
        }
        if (!selectedFamilyId) {
            alert("Select a family")
            return
        }

        setIsSaving(true)
        const { error } = await supabase
            .from('users')
            .insert([{
                username: newUserName.trim(),
                pin: newUserPin.trim() || null,
                family_id: selectedFamilyId
            }])

        if (error) {
            alert(`Failed to add user: ${error.message}`)
        } else {
            setNewUserName("")
            setNewUserPin("")
            await fetchUsers(selectedFamilyId)
        }
        setIsSaving(false)
    }

    const handleUserDelete = async (userId: string) => {
        const target = users.find(u => u.id === userId)
        const ok = confirm(`Delete ${target?.username}? This deletes their bets and predictions.`)
        if (!ok) return
        const pin = prompt("Enter admin PIN to confirm deletion:")
        if (pin !== adminPin) {
            alert("Incorrect admin PIN")
            return
        }
        const okFinal = confirm(`Final confirmation: delete ${target?.username}?`)
        if (!okFinal) return

        setIsSaving(true)
        await supabase.from('bets').delete().eq('user_id', userId)
        await supabase.from('predictions').delete().eq('user_id', userId)
        const { error } = await supabase.from('users').delete().eq('id', userId)

        if (error) {
            alert(`Failed to delete user: ${error.message}`)
        } else {
            await fetchUsers(selectedFamilyId)
        }
        setIsSaving(false)
    }

    const handleMerge = async () => {
        if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) {
            alert("Select two different people to merge.")
            return
        }

        const source = users.find(u => u.id === mergeSourceId)
        const target = users.find(u => u.id === mergeTargetId)
        if (!source || !target) return

        const selectedYears = Object.entries(mergeSelections)
            .filter(([, selection]) => selection !== null)
            .map(([year]) => Number(year))

        if (selectedYears.length === 0) {
            alert("Select at least one year to move.")
            return
        }

        const pin = prompt("Enter admin PIN to confirm merge:")
        if (pin !== adminPin) {
            alert("Incorrect admin PIN")
            return
        }

        const ok = confirm(`Merge ${source.username} into ${target.username}? This will delete ${source.username}.`)
        if (!ok) return

        setIsSaving(true)

        const { data: familyPredictions } = await supabase
            .from('predictions')
            .select('id, year')
            .eq('family_id', selectedFamilyId)

        const predictionIdsByYear = new Map<number, string[]>()
        familyPredictions?.forEach((pred: any) => {
            const list = predictionIdsByYear.get(pred.year) || []
            list.push(pred.id)
            predictionIdsByYear.set(pred.year, list)
        })

        for (const year of selectedYears) {
            const selection = mergeSelections[year]
            const yearPredictionIds = predictionIdsByYear.get(year) || []

            if (selection === "source") {
                if (yearPredictionIds.length > 0) {
                    await supabase.from('bets').delete().in('prediction_id', yearPredictionIds).eq('user_id', mergeTargetId)
                }

                await supabase
                    .from('predictions')
                    .delete()
                    .eq('user_id', mergeTargetId)
                    .eq('family_id', selectedFamilyId)
                    .eq('year', year)

                await supabase
                    .from('predictions')
                    .update({ user_id: mergeTargetId })
                    .eq('user_id', mergeSourceId)
                    .eq('family_id', selectedFamilyId)
                    .eq('year', year)

                if (yearPredictionIds.length > 0) {
                    await supabase
                        .from('bets')
                        .update({ user_id: mergeTargetId })
                        .eq('user_id', mergeSourceId)
                        .in('prediction_id', yearPredictionIds)
                }
            } else if (selection === "target") {
                if (yearPredictionIds.length > 0) {
                    await supabase
                        .from('bets')
                        .delete()
                        .eq('user_id', mergeSourceId)
                        .in('prediction_id', yearPredictionIds)
                }

                await supabase
                    .from('predictions')
                    .delete()
                    .eq('user_id', mergeSourceId)
                    .eq('family_id', selectedFamilyId)
                    .eq('year', year)
            }
        }

        await supabase.from('bets').delete().eq('user_id', mergeSourceId)
        await supabase.from('predictions').delete().eq('user_id', mergeSourceId)
        await supabase.from('users').delete().eq('id', mergeSourceId)

        await fetchUsers(selectedFamilyId)
        await refreshFamilies()

        setMergeSourceId("")
        setMergeTargetId("")
        setMergeSelections({})
        setMergeOptions([])
        setIsSaving(false)
    }

    const handleRemoveFromYear = async () => {
        if (!removeUserId || removeYear === "") {
            alert("Select a person and year.")
            return
        }

        const target = users.find(u => u.id === removeUserId)
        const pin = prompt("Enter master admin PIN to remove from year:")
        if (pin !== adminPin) {
            alert("Incorrect admin PIN")
            return
        }

        const ok = confirm(`Remove ${target?.username} from ${removeYear}? This deletes their predictions and bets for that year only.`)
        if (!ok) return

        setIsSaving(true)

        const { data: yearPredictions } = await supabase
            .from('predictions')
            .select('id')
            .eq('family_id', selectedFamilyId)
            .eq('year', removeYear)

        const yearPredictionIds = yearPredictions?.map(p => p.id) || []

        if (yearPredictionIds.length > 0) {
            await supabase
                .from('bets')
                .delete()
                .eq('user_id', removeUserId)
                .in('prediction_id', yearPredictionIds)
        }

        await supabase
            .from('predictions')
            .delete()
            .eq('user_id', removeUserId)
            .eq('family_id', selectedFamilyId)
            .eq('year', removeYear)

        setRemoveUserId("")
        setRemoveYear("")
        setIsSaving(false)
    }

    const handleVerify = () => {
        if (pinAttempt.trim() === adminPin) {
            setIsVerified(true)
            setPinError("")
        } else {
            setPinError("Incorrect admin PIN")
        }
    }

    const handleAdminPinSave = async () => {
        const nextPin = newAdminPin.trim()
        if (!nextPin) {
            setPinError("Admin PIN cannot be empty")
            return
        }
        const result = await updateAdminPin(nextPin)
        if (!result.success) {
            setPinError(result.error || "Failed to update admin PIN")
            return
        }
        setNewAdminPin("")
        setPinError("")
        setPinAttempt("")
        setIsVerified(true)
    }

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                    setIsOpen(true)
                    setIsVerified(false)
                    setPinAttempt("")
                    setPinError("")
                }}
                className="p-2 text-stone-400 hover:text-stone-700"
            >
                <Settings className="h-4 w-4" />
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-stone-900/20 backdrop-blur-sm animate-in fade-in overflow-auto">
                    <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-5xl p-6 md:p-8 space-y-8 shadow-2xl relative">
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-800"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <h3 className="text-2xl font-bold text-stone-800">Admin Panel</h3>
                            <p className="text-stone-500 text-sm">Manage families, pins, and participants.</p>
                        </div>

                        {!isVerified ? (
                            <section className="space-y-4 max-w-md">
                                <div className="flex items-center gap-2 text-stone-700 font-semibold">
                                    <KeyRound className="w-4 h-4" />
                                    Admin PIN Required
                                </div>
                                <Input
                                    value={pinAttempt}
                                    onChange={(e) => setPinAttempt(e.target.value)}
                                    placeholder="Enter admin PIN"
                                    className="text-center tracking-widest"
                                />
                                {pinError && <p className="text-sm text-rose-500">{pinError}</p>}
                                <Button onClick={handleVerify} size="sm" className="w-full">
                                    Unlock Admin Panel
                                </Button>
                            </section>
                        ) : (
                            <>
                                <section className="space-y-4 max-w-md">
                                    <div className="flex items-center gap-2 text-stone-700 font-semibold">
                                        <KeyRound className="w-4 h-4" />
                                        Admin PIN
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                                        <Input
                                            value={newAdminPin}
                                            onChange={(e) => setNewAdminPin(e.target.value)}
                                            placeholder="New admin PIN"
                                        />
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleAdminPinSave}
                                            disabled={isSaving}
                                        >
                                            <Save className="w-4 h-4 mr-1" /> Update
                                        </Button>
                                    </div>
                                    {pinError && <p className="text-sm text-rose-500">{pinError}</p>}
                                </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-stone-700 font-semibold">
                                <Users className="w-4 h-4" />
                                Families
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {families.map(fam => (
                                    <div key={fam.id} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center border border-stone-200 rounded-2xl p-4">
                                        <Input
                                            value={familyEdits[fam.id]?.name || ""}
                                            onChange={(e) => setFamilyEdits(prev => ({
                                                ...prev,
                                                [fam.id]: { ...prev[fam.id], name: e.target.value }
                                            }))}
                                            className="md:flex-1"
                                            placeholder="Family name"
                                        />
                                        <Input
                                            value={familyEdits[fam.id]?.pin || ""}
                                            onChange={(e) => setFamilyEdits(prev => ({
                                                ...prev,
                                                [fam.id]: { ...prev[fam.id], pin: e.target.value }
                                            }))}
                                            className="md:w-32"
                                            placeholder="PIN"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleFamilySave(fam.id)}
                                                disabled={isSaving}
                                            >
                                                <Save className="w-4 h-4 mr-1" /> Save
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleFamilyDelete(fam.id)}
                                                disabled={isSaving}
                                                className="text-rose-600 border-rose-200 hover:bg-rose-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center border border-dashed border-stone-300 rounded-2xl p-4">
                                <Input
                                    value={newFamilyName}
                                    onChange={(e) => setNewFamilyName(e.target.value)}
                                    className="md:flex-1"
                                    placeholder="New family name"
                                />
                                <Input
                                    value={newFamilyPin}
                                    onChange={(e) => setNewFamilyPin(e.target.value)}
                                    className="md:w-32"
                                    placeholder="PIN"
                                />
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleFamilyAdd}
                                    disabled={isSaving}
                                >
                                    <UserPlus className="w-4 h-4 mr-1" /> Add Family
                                </Button>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center gap-3">
                                <div className="text-stone-700 font-semibold">Individuals</div>
                                <select
                                    value={selectedFamilyId}
                                    onChange={(e) => setSelectedFamilyId(e.target.value)}
                                    className={cn(
                                        "h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-700",
                                        "focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                                    )}
                                >
                                    {familyOptions.map(option => (
                                        <option key={option.id} value={option.id}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                            {isLoadingUsers ? (
                                <div className="text-sm text-stone-400">Loading users...</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {users.map(user => (
                                        <div key={user.id} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center border border-stone-200 rounded-2xl p-4">
                                            <Input
                                                value={userEdits[user.id]?.username || ""}
                                                onChange={(e) => setUserEdits(prev => ({
                                                    ...prev,
                                                    [user.id]: { ...prev[user.id], username: e.target.value }
                                                }))}
                                                className="md:flex-1"
                                                placeholder="Name"
                                            />
                                            <Input
                                                value={userEdits[user.id]?.pin || ""}
                                                onChange={(e) => setUserEdits(prev => ({
                                                    ...prev,
                                                    [user.id]: { ...prev[user.id], pin: e.target.value }
                                                }))}
                                                className="md:w-32"
                                                placeholder="PIN"
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleUserSave(user.id)}
                                                    disabled={isSaving}
                                                >
                                                    <Save className="w-4 h-4 mr-1" /> Save
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleUserDelete(user.id)}
                                                    disabled={isSaving}
                                                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    {users.length === 0 && (
                                        <div className="text-sm text-stone-400">No users in this family yet.</div>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center border border-dashed border-stone-300 rounded-2xl p-4">
                                <Input
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    className="md:flex-1"
                                    placeholder="New person name"
                                />
                                <Input
                                    value={newUserPin}
                                    onChange={(e) => setNewUserPin(e.target.value)}
                                    className="md:w-32"
                                    placeholder="PIN (optional)"
                                />
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleUserAdd}
                                    disabled={isSaving}
                                >
                                    <UserPlus className="w-4 h-4 mr-1" /> Add Person
                                </Button>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="text-stone-700 font-semibold">Merge People (within this family)</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-stone-500">Source (will be deleted)</label>
                                    <select
                                        value={mergeSourceId}
                                        onChange={(e) => setMergeSourceId(e.target.value)}
                                        className={cn(
                                            "h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-700 w-full",
                                            "focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                                        )}
                                    >
                                        <option value="">Select person</option>
                                        {users.map(user => (
                                            <option key={user.id} value={user.id}>{user.username}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-stone-500">Target (kept)</label>
                                    <select
                                        value={mergeTargetId}
                                        onChange={(e) => setMergeTargetId(e.target.value)}
                                        className={cn(
                                            "h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-700 w-full",
                                            "focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                                        )}
                                    >
                                        <option value="">Select person</option>
                                        {users.map(user => (
                                            <option key={user.id} value={user.id}>{user.username}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {mergeSourceId && mergeTargetId && mergeSourceId !== mergeTargetId && (
                                <div className="space-y-3">
                                    {mergeOptions.length === 0 && (
                                        <div className="text-sm text-stone-400">No years found for either user.</div>
                                    )}
                                    {mergeOptions.map(entry => (
                                        <div key={entry.year} className="flex flex-col md:flex-row md:items-center gap-4 border border-stone-200 rounded-2xl p-3">
                                            <div className="text-sm font-semibold text-stone-700 w-16">{entry.year}</div>
                                            <label className={cn(
                                                "flex items-center gap-2 text-sm",
                                                entry.hasSource ? "text-stone-700" : "text-stone-300"
                                            )}>
                                                <input
                                                    type="checkbox"
                                                    disabled={!entry.hasSource}
                                                    checked={mergeSelections[entry.year] === "source"}
                                                    onChange={(e) => setMergeSelections(prev => ({
                                                        ...prev,
                                                        [entry.year]: e.target.checked ? "source" : null
                                                    }))}
                                                />
                                                <span>Keep source</span>
                                            </label>
                                            <label className={cn(
                                                "flex items-center gap-2 text-sm",
                                                entry.hasTarget ? "text-stone-700" : "text-stone-300"
                                            )}>
                                                <input
                                                    type="checkbox"
                                                    disabled={!entry.hasTarget}
                                                    checked={mergeSelections[entry.year] === "target"}
                                                    onChange={(e) => setMergeSelections(prev => ({
                                                        ...prev,
                                                        [entry.year]: e.target.checked ? "target" : null
                                                    }))}
                                                />
                                                <span>Keep target</span>
                                            </label>
                                        </div>
                                    ))}
                                    <div className="text-xs text-stone-400">
                                        For each year, pick which person to keep. Years not selected will be deleted with the source user.
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleMerge}
                                        disabled={isSaving}
                                        className="w-full md:w-auto text-rose-600 border-rose-200 hover:bg-rose-50"
                                    >
                                        Merge & Delete Source
                                    </Button>
                                </div>
                            )}
                        </section>

                        <section className="space-y-4">
                            <div className="text-stone-700 font-semibold">Remove Person from a Year</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <select
                                    value={removeUserId}
                                    onChange={(e) => setRemoveUserId(e.target.value)}
                                    className={cn(
                                        "h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-700 w-full",
                                        "focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                                    )}
                                >
                                    <option value="">Select person</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>{user.username}</option>
                                    ))}
                                </select>
                                <select
                                    value={removeYear}
                                    onChange={(e) => setRemoveYear(Number(e.target.value))}
                                    className={cn(
                                        "h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-700 w-full",
                                        "focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                                    )}
                                >
                                    <option value="">Select year</option>
                                    {yearOptions.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRemoveFromYear}
                                    disabled={isSaving}
                                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                    Remove from Year
                                </Button>
                            </div>
                        </section>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
