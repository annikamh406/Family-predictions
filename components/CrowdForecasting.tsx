'use client'

import { useEffect, useMemo, useRef, useState } from "react"
import { useUser } from "@/contexts/UserContext"
import { supabase } from "@/utils/supabase"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { cn } from "@/utils/cn"
import {
    CrowdEvent,
    CrowdForecast,
    CrowdSnapshot,
    buildDefaultDistribution,
    eventTypeLabel,
    formatSnapshotLabel,
    getBinSpec,
    getSnapshotDate,
    normalizeDistribution
} from "@/utils/crowd"
import { CrowdToggle } from "./CrowdToggle"
import { AdminPanel } from "./AdminPanel"
import { FamilyPinModal } from "./FamilyPinModal"
import { Loader2, Plus, Trash2, Pencil, Check, X, LogOut } from "lucide-react"

type EventFormState = {
    title: string
    description: string
    type: CrowdEvent['type']
    snapshot_cadence: CrowdEvent['snapshot_cadence']
    min_year: string
    max_year: string
    target_date: string
}

const emptyForm: EventFormState = {
    title: "",
    description: "",
    type: "by_year",
    snapshot_cadence: "monthly",
    min_year: "",
    max_year: "",
    target_date: ""
}

export function CrowdForecasting() {
    const { user, isGuest, adminPin, logout, family } = useUser()
    const [events, setEvents] = useState<CrowdEvent[]>([])
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
    const [isLoadingEvents, setIsLoadingEvents] = useState(true)
    const [selectedSnapshot, setSelectedSnapshot] = useState<string>('latest')
    const [snapshots, setSnapshots] = useState<CrowdSnapshot[]>([])
    const [aggregateDistribution, setAggregateDistribution] = useState<number[] | null>(null)
    const [userForecast, setUserForecast] = useState<CrowdForecast | null>(null)
    const [rawEditorValues, setRawEditorValues] = useState<number[]>([])
    const [isSavingForecast, setIsSavingForecast] = useState(false)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hasLoadedRef = useRef(false)
    const [isCreating, setIsCreating] = useState(false)
    const [newEvent, setNewEvent] = useState<EventFormState>(emptyForm)
    const [isEditing, setIsEditing] = useState(false)
    const [editEvent, setEditEvent] = useState<EventFormState>(emptyForm)
    const [isSavingEvent, setIsSavingEvent] = useState(false)

    const selectedEvent = useMemo(
        () => events.find(e => e.id === selectedEventId) || null,
        [events, selectedEventId]
    )

    useEffect(() => {
        loadEvents()
    }, [])

    useEffect(() => {
        if (!selectedEvent) return
        setSelectedSnapshot('latest')
        loadEventData(selectedEvent)
    }, [selectedEvent?.id])

    const loadEvents = async () => {
        setIsLoadingEvents(true)
        const { data } = await supabase
            .from('crowd_events')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
        setEvents((data || []) as CrowdEvent[])
        setIsLoadingEvents(false)
        if (!selectedEventId && data?.length) {
            setSelectedEventId(data[0].id)
        }
    }

    const loadEventData = async (event: CrowdEvent) => {
        const [{ data: snapshotData }, { data: forecastData }, { data: allForecasts }] = await Promise.all([
            supabase
                .from('crowd_snapshot_bins')
                .select('*')
                .eq('event_id', event.id)
                .order('snapshot_at', { ascending: false }),
            user?.id
                ? supabase
                    .from('crowd_forecasts')
                    .select('*')
                    .eq('event_id', event.id)
                    .eq('user_id', user.id)
                    .maybeSingle()
                : Promise.resolve({ data: null }),
            supabase
                .from('crowd_forecasts')
                .select('distribution')
                .eq('event_id', event.id)
        ])

        const snapshotsList = (snapshotData || []) as CrowdSnapshot[]
        setSnapshots(snapshotsList)
        setUserForecast(forecastData as CrowdForecast | null)

        const liveAggregate = buildAggregateDistribution(event, allForecasts as any)
        setAggregateDistribution(liveAggregate)

        const spec = getBinSpec(event)
        const existing = forecastData?.distribution
        const baseValues = Array.isArray(existing) && existing.length === spec.bucketCount
            ? existing
            : buildDefaultDistribution(event)
        setRawEditorValues(normalizeDistribution(baseValues))
        hasLoadedRef.current = true
    }

    const buildAggregateDistribution = (event: CrowdEvent, forecasts: { distribution: number[] }[] | null) => {
        const spec = getBinSpec(event)
        if (!forecasts || forecasts.length === 0 || spec.bucketCount === 0) {
            return []
        }
        const sums = new Array(spec.bucketCount).fill(0)
        let count = 0
        forecasts.forEach(forecast => {
            if (!Array.isArray(forecast.distribution)) return
            if (forecast.distribution.length !== spec.bucketCount) return
            forecast.distribution.forEach((value, idx) => {
                sums[idx] += value
            })
            count += 1
        })
        if (count === 0) return []
        const avg = sums.map(v => v / count)
        return normalizeDistribution(avg)
    }

    const handleCreateEvent = async () => {
        if (!newEvent.title.trim()) return
        if (newEvent.type === 'by_deadline' && !newEvent.target_date) {
            alert("Please choose a deadline date.")
            return
        }
        setIsSavingEvent(true)

        const payload: Partial<CrowdEvent> = {
            title: newEvent.title.trim(),
            description: newEvent.description.trim() || null,
            type: newEvent.type,
            status: 'open',
            snapshot_cadence: newEvent.snapshot_cadence,
            date_granularity: null,
            min_year: newEvent.type === 'by_year'
                ? Number(newEvent.min_year) || null
                : null,
            max_year: newEvent.type === 'by_year'
                ? Number(newEvent.max_year) || null
                : null,
            target_date: newEvent.type === 'by_deadline'
                ? newEvent.target_date || null
                : null,
            created_by: user?.id || null
        }

        const { data, error } = await supabase
            .from('crowd_events')
            .insert([payload])
            .select('*')
            .single()

        if (!error && data) {
            setEvents(prev => [data as CrowdEvent, ...prev])
            setSelectedEventId(data.id)
            setIsCreating(false)
            setNewEvent(emptyForm)
        }
        setIsSavingEvent(false)
    }

    const promptAdminPin = () => {
        const attempt = prompt("Enter admin PIN:")
        return attempt === adminPin
    }

    const handleDeleteEvent = async () => {
        if (!selectedEvent) return
        if (!promptAdminPin()) {
            alert("Incorrect admin PIN")
            return
        }
        const ok = confirm(`Delete "${selectedEvent.title}"?`)
        if (!ok) return

        setIsSavingEvent(true)
        const { error } = await supabase
            .from('crowd_events')
            .update({ deleted_at: new Date().toISOString(), status: 'closed' })
            .eq('id', selectedEvent.id)

        if (!error) {
            setEvents(prev => prev.filter(e => e.id !== selectedEvent.id))
            setSelectedEventId(null)
        }
        setIsSavingEvent(false)
    }

    const handleStartEdit = () => {
        if (!selectedEvent) return
        if (!promptAdminPin()) {
            alert("Incorrect admin PIN")
            return
        }
        setEditEvent({
            title: selectedEvent.title,
            description: selectedEvent.description || "",
            type: selectedEvent.type,
            snapshot_cadence: selectedEvent.snapshot_cadence,
            min_year: selectedEvent.min_year?.toString() || "",
            max_year: selectedEvent.max_year?.toString() || "",
            target_date: selectedEvent.target_date || ""
        })
        setIsEditing(true)
    }

    const handleSaveEdit = async () => {
        if (!selectedEvent) return
        if (editEvent.type === 'by_deadline' && !editEvent.target_date) {
            alert("Please choose a deadline date.")
            return
        }
        setIsSavingEvent(true)
        const payload: Partial<CrowdEvent> = {
            title: editEvent.title.trim(),
            description: editEvent.description.trim() || null,
            type: editEvent.type,
            snapshot_cadence: editEvent.snapshot_cadence,
            date_granularity: null,
            min_year: editEvent.type === 'by_year'
                ? Number(editEvent.min_year) || null
                : null,
            max_year: editEvent.type === 'by_year'
                ? Number(editEvent.max_year) || null
                : null,
            target_date: editEvent.type === 'by_deadline'
                ? editEvent.target_date || null
                : null,
            updated_at: new Date().toISOString()
        }

        const { data, error } = await supabase
            .from('crowd_events')
            .update(payload)
            .eq('id', selectedEvent.id)
            .select('*')
            .single()

        if (!error && data) {
            setEvents(prev => prev.map(e => e.id === data.id ? (data as CrowdEvent) : e))
            setIsEditing(false)
        }
        setIsSavingEvent(false)
    }

    const handleResolve = async () => {
        if (!selectedEvent) return
        if (!promptAdminPin()) {
            alert("Incorrect admin PIN")
            return
        }
        const happened = confirm("Did the event happen?")
        let actualDate = ""
        if (happened) {
            actualDate = prompt("Enter resolution date (YYYY-MM-DD):") || ""
        }

        const resolution = {
            resolved_at: new Date().toISOString(),
            happened,
            actual_date: actualDate || null
        }

        setIsSavingEvent(true)
        const { data, error } = await supabase
            .from('crowd_events')
            .update({ status: 'resolved', resolution })
            .eq('id', selectedEvent.id)
            .select('*')
            .single()

        if (!error && data) {
            setEvents(prev => prev.map(e => e.id === data.id ? (data as CrowdEvent) : e))
        }
        setIsSavingEvent(false)
    }

    const handleExtendYears = async (direction: 'future' | 'past') => {
        if (!selectedEvent || selectedEvent.type !== 'by_year') return
        if (!user || isGuest) return

        const currentYear = new Date().getFullYear()
        const minYear = selectedEvent.min_year || currentYear
        const maxYear = selectedEvent.max_year || minYear + 5
        const nextMin = direction === 'past' ? minYear - 1 : minYear
        const nextMax = direction === 'future' ? maxYear + 1 : maxYear

        const { data, error } = await supabase
            .from('crowd_events')
            .update({ min_year: nextMin, max_year: nextMax, updated_at: new Date().toISOString() })
            .eq('id', selectedEvent.id)
            .select('*')
            .single()

        if (!error && data) {
            setEvents(prev => prev.map(e => e.id === data.id ? (data as CrowdEvent) : e))
            setRawEditorValues(prev => {
                const next = direction === 'past' ? [0, ...prev] : [...prev, 0]
                return next
            })
        }
    }

    const handleSubmitForecast = async () => {
        if (!selectedEvent || !user || isGuest) return
        const normalized = normalizeByScaling(rawEditorValues)
        setIsSavingForecast(true)

        const distribution = normalized
        const { data, error } = await supabase
            .from('crowd_forecasts')
            .upsert([{
                event_id: selectedEvent.id,
                user_id: user.id,
                distribution
            }], { onConflict: 'event_id,user_id' })
            .select('*')
            .single()

        if (!error && data) {
            setUserForecast(data as CrowdForecast)
            await refreshSnapshots(selectedEvent)
        }
        setIsSavingForecast(false)
    }

    const refreshSnapshots = async (event: CrowdEvent) => {
        const { data: allForecasts } = await supabase
            .from('crowd_forecasts')
            .select('distribution')
            .eq('event_id', event.id)

        const aggregate = buildAggregateDistribution(event, allForecasts as any)
        setAggregateDistribution(aggregate)

        const snapshotAt = getSnapshotDate(event.snapshot_cadence)
        await supabase
            .from('crowd_snapshot_bins')
            .upsert([{
                event_id: event.id,
                snapshot_at: snapshotAt,
                distribution: aggregate
            }], { onConflict: 'event_id,snapshot_at' })

        const { data: snapshotData } = await supabase
            .from('crowd_snapshot_bins')
            .select('*')
            .eq('event_id', event.id)
            .order('snapshot_at', { ascending: false })

        const nextSnapshots = (snapshotData || []) as CrowdSnapshot[]
        setSnapshots(nextSnapshots)
        setSelectedSnapshot((prev) => {
            if (prev === 'latest') return prev
            const exists = nextSnapshots.some(snapshot => snapshot.snapshot_at === prev)
            return exists ? prev : 'latest'
        })
    }

    const formatEventHeaderLabel = (event: CrowdEvent) => {
        if (event.type !== 'by_deadline' || !event.target_date) {
            return eventTypeLabel(event.type)
        }
        const date = new Date(event.target_date)
        const formatted = Number.isNaN(date.getTime())
            ? event.target_date
            : date.toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: '2-digit'
            })
        return `By ${formatted}`
    }

    const normalizedEditorValues = useMemo(
        () => normalizeByScaling(rawEditorValues),
        [rawEditorValues]
    )
    const snapshotOptions = useMemo(() => {
        if (!selectedEvent) {
            return [{ value: 'latest', label: 'Latest (live)' }]
        }
        return [
            ...snapshots.map(snapshot => ({
                value: snapshot.snapshot_at,
                label: formatSnapshotLabel(snapshot.snapshot_at, selectedEvent.snapshot_cadence)
            })),
            { value: 'latest', label: 'Latest (live)' }
        ]
    }, [snapshots, selectedEvent?.id, selectedEvent?.snapshot_cadence])
    const selectedSnapshotIndex = useMemo(() => {
        const index = snapshotOptions.findIndex(option => option.value === selectedSnapshot)
        return index >= 0 ? index : 0
    }, [snapshotOptions, selectedSnapshot])
    const selectedSnapshotLabel = snapshotOptions[selectedSnapshotIndex]?.label ?? 'Latest (live)'
    const chartValues = useMemo(() => {
        if (!selectedEvent) return []
        if (selectedSnapshot === 'latest') {
            return aggregateDistribution && aggregateDistribution.length > 0 ? aggregateDistribution : []
        }
        const target = snapshots.find(s => s.snapshot_at === selectedSnapshot)
        return target?.distribution || []
    }, [selectedSnapshot, snapshots, aggregateDistribution, selectedEvent?.id])

    useEffect(() => {
        if (!selectedEvent || !user || isGuest) return
        if (!hasLoadedRef.current) {
            hasLoadedRef.current = true
            return
        }
        if (normalizedEditorValues.length === 0) return
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(() => {
            handleSubmitForecast()
        }, 600)
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        }
    }, [normalizedEditorValues, selectedEvent?.id, user?.id, isGuest])

    return (
        <div className="min-h-screen bg-stone-50 relative selection:bg-stone-200">
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-rose-100/40 rounded-full blur-[120px] pointer-events-none" />

            <div className="absolute top-4 left-4 right-4 z-40 pr-12">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="hidden md:block" />
                    <div className="justify-self-center">
                        <CrowdToggle />
                    </div>
                    <div className="flex items-center gap-2 justify-self-end">
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

            <div className="w-full pt-20 md:pt-24 pb-4 md:pb-8 2xl:max-w-6xl 2xl:mx-auto">
                <div className="overflow-x-auto px-4 md:px-8">
                    <div className="inline-block min-w-full space-y-6 pr-2 md:pr-4">
                        <header className="glass-panel p-4">
                            <div className="space-y-1">
                                <h1 className="text-2xl font-bold text-stone-800">Crowd Forecasting</h1>
                                <p className="text-sm text-stone-500">
                                    Global events with shared probability distributions and time‑based snapshots.
                                </p>
                            </div>
                        </header>

                        <div className="grid md:grid-cols-[320px_1fr] gap-6">
                            <aside className="space-y-4">
                        <div className="glass-panel p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-stone-600 uppercase tracking-wider">Events</h2>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setIsCreating(prev => !prev)}
                                >
                                    <Plus className="w-4 h-4 mr-1" /> New
                                </Button>
                            </div>

                            {isCreating && (
                                <div className="space-y-3 bg-white border border-stone-200 rounded-xl p-3">
                                    <Input
                                        placeholder="Event title"
                                        value={newEvent.title}
                                        onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                    <textarea
                                        placeholder="Short description"
                                        value={newEvent.description}
                                        onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full rounded-xl border border-stone-200 p-2 text-sm text-stone-700"
                                        rows={3}
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={newEvent.type}
                                            onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value as CrowdEvent['type'] }))}
                                            className="h-10 rounded-lg border border-stone-200 bg-white px-2 text-sm"
                                        >
                                            <option value="by_year">Year of occurrence</option>
                                            <option value="by_deadline">By deadline</option>
                                        </select>
                                        <select
                                            value={newEvent.snapshot_cadence}
                                            onChange={(e) => setNewEvent(prev => ({ ...prev, snapshot_cadence: e.target.value as CrowdEvent['snapshot_cadence'] }))}
                                            className="h-10 rounded-lg border border-stone-200 bg-white px-2 text-sm"
                                        >
                                            <option value="monthly">Monthly snapshots</option>
                                            <option value="weekly">Weekly snapshots</option>
                                        </select>
                                    </div>

                                    {newEvent.type === 'by_year' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input
                                                placeholder="Min year"
                                                value={newEvent.min_year}
                                                onChange={(e) => setNewEvent(prev => ({ ...prev, min_year: e.target.value }))}
                                            />
                                            <Input
                                                placeholder="Max year"
                                                value={newEvent.max_year}
                                                onChange={(e) => setNewEvent(prev => ({ ...prev, max_year: e.target.value }))}
                                            />
                                        </div>
                                    )}

                                    {newEvent.type === 'by_deadline' && (
                                        <Input
                                            type="date"
                                            value={newEvent.target_date}
                                            onChange={(e) => setNewEvent(prev => ({ ...prev, target_date: e.target.value }))}
                                        />
                                    )}

                                    <div className="flex items-center gap-2">
                                        <Button size="sm" onClick={handleCreateEvent} isLoading={isSavingEvent}>
                                            Create
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setIsCreating(false)
                                                setNewEvent(emptyForm)
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {isLoadingEvents ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="w-5 h-5 animate-spin text-stone-300" />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {events.map(event => (
                                        <button
                                            key={event.id}
                                            onClick={() => setSelectedEventId(event.id)}
                                            className={cn(
                                                "w-full text-left p-3 rounded-xl border transition-all",
                                                selectedEventId === event.id
                                                    ? "border-stone-300 bg-white shadow-sm"
                                                    : "border-stone-100 hover:border-stone-200 hover:bg-white/60"
                                            )}
                                        >
                                            <div className="text-sm font-semibold text-stone-700">{event.title}</div>
                                        <div className="text-xs text-stone-400">
                                            {formatEventHeaderLabel(event)} • {event.snapshot_cadence}
                                        </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </aside>

                    <section className="glass-panel p-6 min-h-[400px]">
                        {!selectedEvent ? (
                            <div className="text-center py-20 text-stone-400">
                                Select an event to view forecasts.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="text-xs text-stone-400 uppercase tracking-wider">
                                            {formatEventHeaderLabel(selectedEvent)} • {selectedEvent.snapshot_cadence}
                                        </div>
                                        <h2 className="text-2xl font-bold text-stone-800">{selectedEvent.title}</h2>
                                        {selectedEvent.description && (
                                            <p className="text-sm text-stone-500 max-w-2xl">{selectedEvent.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="secondary" onClick={handleStartEdit}>
                                            <Pencil className="w-4 h-4 mr-1" /> Edit
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={handleResolve}>
                                            <Check className="w-4 h-4 mr-1" /> Resolve
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={handleDeleteEvent}>
                                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                                        </Button>
                                    </div>
                                </div>

                                {isEditing && (
                                    <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-stone-700">Edit Event</h3>
                                            <button onClick={() => setIsEditing(false)} className="text-stone-400 hover:text-stone-700">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <Input
                                            value={editEvent.title}
                                            onChange={(e) => setEditEvent(prev => ({ ...prev, title: e.target.value }))}
                                        />
                                        <textarea
                                            value={editEvent.description}
                                            onChange={(e) => setEditEvent(prev => ({ ...prev, description: e.target.value }))}
                                            className="w-full rounded-xl border border-stone-200 p-2 text-sm text-stone-700"
                                            rows={3}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <select
                                                value={editEvent.type}
                                                onChange={(e) => setEditEvent(prev => ({ ...prev, type: e.target.value as CrowdEvent['type'] }))}
                                                className="h-10 rounded-lg border border-stone-200 bg-white px-2 text-sm"
                                            >
                                                <option value="by_year">Year of occurrence</option>
                                                <option value="by_deadline">By deadline</option>
                                            </select>
                                            <select
                                                value={editEvent.snapshot_cadence}
                                                onChange={(e) => setEditEvent(prev => ({ ...prev, snapshot_cadence: e.target.value as CrowdEvent['snapshot_cadence'] }))}
                                                className="h-10 rounded-lg border border-stone-200 bg-white px-2 text-sm"
                                            >
                                                <option value="monthly">Monthly snapshots</option>
                                                <option value="weekly">Weekly snapshots</option>
                                            </select>
                                        </div>
                                        {editEvent.type === 'by_year' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input
                                                    placeholder="Min year"
                                                    value={editEvent.min_year}
                                                    onChange={(e) => setEditEvent(prev => ({ ...prev, min_year: e.target.value }))}
                                                />
                                                <Input
                                                    placeholder="Max year"
                                                    value={editEvent.max_year}
                                                    onChange={(e) => setEditEvent(prev => ({ ...prev, max_year: e.target.value }))}
                                                />
                                            </div>
                                        )}
                                        {editEvent.type === 'by_deadline' && (
                                            <Input
                                                type="date"
                                                value={editEvent.target_date}
                                                onChange={(e) => setEditEvent(prev => ({ ...prev, target_date: e.target.value }))}
                                            />
                                        )}
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" onClick={handleSaveEdit} isLoading={isSavingEvent}>
                                                Save changes
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="text-sm text-stone-500">
                                        {selectedEvent.status === 'resolved'
                                            ? "Resolved"
                                            : selectedEvent.status === 'closed'
                                                ? "Closed"
                                                : "Open for forecasts"}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-xs text-stone-400">Snapshot</span>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min={0}
                                                max={Math.max(snapshotOptions.length - 1, 0)}
                                                step={1}
                                                value={selectedSnapshotIndex}
                                                onChange={(e) => {
                                                    const next = snapshotOptions[Number(e.target.value)]
                                                    if (next) setSelectedSnapshot(next.value)
                                                }}
                                                className="h-1.5 w-48 md:w-56 appearance-none rounded-full bg-stone-200 accent-stone-900"
                                            />
                                            <span className="text-xs text-stone-500 min-w-[120px]">
                                                {selectedSnapshotLabel}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-stone-700">Aggregate Forecast</h3>
                                        <span className="text-xs text-stone-400">{selectedSnapshotLabel}</span>
                                    </div>
                                    <DistributionChart event={selectedEvent} values={chartValues} />
                                </div>

                                <div className="pt-2 border-t border-stone-200">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-stone-700">Your Forecast</h3>
                                        {!user || isGuest ? (
                                            <span className="text-xs text-stone-400">Login to submit</span>
                                        ) : (
                                            <span className="text-xs text-stone-400">
                                                {userForecast?.updated_at
                                                    ? `Saved ${new Date(userForecast.updated_at).toLocaleString()}`
                                                    : "Total must equal 100%"}
                                            </span>
                                        )}
                                    </div>
                                    {user && !isGuest ? (
                                        <div className="mt-4 space-y-3">
                                            <DistributionEditor
                                                event={selectedEvent}
                                                rawValues={rawEditorValues}
                                                normalizedValues={normalizedEditorValues}
                                                onRawChange={setRawEditorValues}
                                                onExtendYears={handleExtendYears}
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => setRawEditorValues(buildDefaultDistribution(selectedEvent))}
                                                >
                                                    Even Spread
                                                </Button>
                                                {isSavingForecast && (
                                                    <span className="text-xs text-stone-400">Saving…</span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-stone-500 mt-3">
                                            You can view aggregate forecasts, but only logged‑in users can submit.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function DistributionChart({ event, values }: { event: CrowdEvent; values: number[] }) {
    const spec = getBinSpec(event)
    if (!values || values.length === 0) {
        return (
            <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center text-stone-400">
                No forecasts yet.
            </div>
        )
    }

    const hasNever = event.type === 'by_year' && spec.labels[spec.labels.length - 1] === 'Never'
    const displayOrder = hasNever
        ? [spec.labels.length - 1, ...Array.from({ length: spec.labels.length - 1 }, (_, idx) => idx)]
        : spec.labels.map((_, idx) => idx)
    const displayValues = mapValues(values, displayOrder)
    const maxValue = Math.max(...displayValues, 1)
    const chartHeight = 140
    const chartPadding = 8
    const points = displayValues.map((value, idx) => {
        const x = (idx / Math.max(displayValues.length - 1, 1)) * 100
        const y = chartPadding + (1 - value / maxValue) * (chartHeight - chartPadding * 2)
        return { x, y }
    })
    const linePath = buildSmoothPath(points)
    const areaPath = `${linePath} L 100 ${chartHeight - chartPadding} L 0 ${chartHeight - chartPadding} Z`

    return (
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <div className="min-w-[520px]">
                <div className="relative h-40">
                    <svg
                        viewBox={`0 0 100 ${chartHeight}`}
                        preserveAspectRatio="none"
                        className="w-full h-full"
                    >
                        <defs>
                            <linearGradient id="densityFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#1c1917" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#1c1917" stopOpacity="0.05" />
                            </linearGradient>
                        </defs>
                        <path d={areaPath} fill="url(#densityFill)" />
                        <path
                            d={linePath}
                            fill="none"
                            stroke="#1c1917"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            shapeRendering="geometricPrecision"
                        />
                    </svg>
                </div>
                <div className="mt-2 flex gap-1 text-sm font-semibold text-stone-500">
                    {displayValues.map((value, idx) => (
                        <div key={`${idx}-${spec.labels[displayOrder[idx]] || 'bin'}`} className="flex-1 text-center">{value}%</div>
                    ))}
                </div>
                <div className="mt-3 flex gap-1 text-sm font-semibold text-stone-500">
                    {displayOrder.map((rawIndex) => (
                        <div key={spec.labels[rawIndex]} className="flex-1 text-center truncate">{spec.labels[rawIndex]}</div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function buildSmoothPath(points: { x: number; y: number }[]) {
    if (points.length === 0) return ""
    if (points.length === 1) {
        const point = points[0]
        return `M ${point.x} ${point.y}`
    }

    const tension = 0.12
    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
    for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] || points[i]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[i + 2] || p2

        const cp1x = p1.x + (p2.x - p0.x) * tension
        const cp1y = p1.y + (p2.y - p0.y) * tension
        const cp2x = p2.x - (p3.x - p1.x) * tension
        const cp2y = p2.y - (p3.y - p1.y) * tension

        path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
    }
    return path
}

function DistributionEditor({
    event,
    rawValues,
    normalizedValues,
    onRawChange,
    onExtendYears
}: {
    event: CrowdEvent
    rawValues: number[]
    normalizedValues: number[]
    onRawChange: (next: number[]) => void
    onExtendYears: (direction: 'future' | 'past') => void
}) {
    const spec = getBinSpec(event)
    const chartRef = useRef<HTMLDivElement | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const activeIndexRef = useRef<number | null>(null)
    const [inputValues, setInputValues] = useState<string[]>([])
    const [activeInputIndex, setActiveInputIndex] = useState<number | null>(null)
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const total = normalizedValues.reduce((sum, v) => sum + v, 0)
    const chartHeight = 140
    const hasNever = event.type === 'by_year' && spec.labels[spec.labels.length - 1] === 'Never'
    const displayOrder = useMemo(() => {
        if (!hasNever) return spec.labels.map((_, idx) => idx)
        const neverIndex = spec.labels.length - 1
        return [neverIndex, ...Array.from({ length: spec.labels.length - 1 }, (_, idx) => idx)]
    }, [hasNever, spec.labels])

    useEffect(() => {
        if (activeInputIndex !== null) return
        setInputValues(normalizedValues.map(v => String(v)))
    }, [normalizedValues, activeInputIndex])

    if (rawValues.length === 0) {
        return (
            <div className="bg-white border border-stone-200 rounded-2xl p-4 text-sm text-stone-500">
                No bins available for this event yet.
            </div>
        )
    }

    const displayValues = mapValues(rawValues, displayOrder)
    const points = pointsFromValues(displayValues, chartHeight, 100)
    const linePath = buildStepPath(points)
    const areaPath = `${linePath} L 100 ${chartHeight - 8} L 0 ${chartHeight - 8} Z`
    const totalRaw = displayValues.reduce((sum, v) => sum + v, 0)
    const axisTicks = [100, 75, 50, 25, 0]
    const axisLabels = axisTicks.map((tick) => {
        if (totalRaw <= 0) return "0%"
        const scaled = Math.round((tick / totalRaw) * 100)
        const clamped = Math.max(0, Math.min(100, scaled))
        return `${clamped}%`
    })

    const updateFromPointer = (clientX: number, clientY: number) => {
        const container = chartRef.current
        if (!container) return
        const rect = container.getBoundingClientRect()
        const xRatio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
        const displayIndex = activeIndexRef.current ?? Math.round(xRatio * Math.max(displayOrder.length - 1, 1))
        const index = displayOrder[displayIndex] ?? displayIndex
        const yRatio = Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height))
        const targetValue = Math.round(yRatio * 100)
        onRawChange(applyBrush(rawValues, index, targetValue))
    }

    const updateHoverFromPointer = (clientX: number, clientY: number) => {
        const container = chartRef.current
        if (!container) return
        const rect = container.getBoundingClientRect()
        const xRatio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
        const pointerY = clientY - rect.top
        const lineY = getLineYAtRatio(displayValues, xRatio, chartHeight)
        if (Math.abs(pointerY - lineY) > 20) {
            setHoveredIndex(null)
            return
        }
        const displayIndex = Math.round(xRatio * Math.max(displayOrder.length - 1, 1))
        setHoveredIndex(displayIndex)
    }

    return (
        <div className="space-y-4">
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <div className="relative px-10">
                    {event.type === 'by_year' && (
                        <button
                            type="button"
                            onClick={() => onExtendYears('past')}
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-stone-200 bg-white text-stone-500 hover:text-stone-800 shadow-sm"
                            aria-label="Add previous year"
                        >
                            +
                        </button>
                    )}
                    {event.type === 'by_year' && (
                        <button
                            type="button"
                            onClick={() => onExtendYears('future')}
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-stone-200 bg-white text-stone-500 hover:text-stone-800 shadow-sm"
                            aria-label="Add next year"
                        >
                            +
                        </button>
                    )}
                    <div
                        className={cn("relative h-40 rounded-xl border border-dashed border-stone-200 bg-white/70", isDragging && "ring-2 ring-stone-300")}
                    >
                        <div className="absolute inset-y-2 left-2 flex flex-col justify-between text-[11px] font-semibold text-stone-500">
                            {axisLabels.map((label) => (
                                <span key={label}>{label}</span>
                            ))}
                        </div>
                        <div
                            ref={chartRef}
                            className="absolute inset-y-0 left-10 right-0 group"
                            onPointerDown={(e) => {
                                const container = chartRef.current
                                if (!container) return
                                const rect = container.getBoundingClientRect()
                                const xRatio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
                                const pointerY = e.clientY - rect.top
                                const lineY = getLineYAtRatio(displayValues, xRatio, chartHeight)
                                if (Math.abs(pointerY - lineY) > 24) return
                                const displayIndex = Math.round(xRatio * Math.max(displayOrder.length - 1, 1))
                                activeIndexRef.current = displayIndex
                                container.setPointerCapture(e.pointerId)
                                setIsDragging(true)
                                updateFromPointer(e.clientX, e.clientY)
                            }}
                            onPointerMove={(e) => {
                                if (isDragging) {
                                    updateFromPointer(e.clientX, e.clientY)
                                } else {
                                    updateHoverFromPointer(e.clientX, e.clientY)
                                }
                            }}
                            onPointerUp={(e) => {
                                const container = chartRef.current
                                if (container) container.releasePointerCapture(e.pointerId)
                                setIsDragging(false)
                                activeIndexRef.current = null
                            }}
                            onPointerLeave={() => {
                                setIsDragging(false)
                                activeIndexRef.current = null
                                setHoveredIndex(null)
                            }}
                        >
                            <svg
                                viewBox={`0 0 100 ${chartHeight}`}
                                preserveAspectRatio="none"
                                className="w-full h-full"
                            >
                                <defs>
                                    <linearGradient id="editorFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#1c1917" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#1c1917" stopOpacity="0.05" />
                                    </linearGradient>
                                </defs>
                                <path d={areaPath} fill="url(#editorFill)" />
                                <path
                                    d={linePath}
                                    fill="none"
                                    stroke="#1c1917"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                    shapeRendering="geometricPrecision"
                                />
                            </svg>
                            <div className="absolute inset-0 pointer-events-none">
                                {points.map((point, idx) => (
                                    <span
                                        key={`${idx}-${point.x.toFixed(2)}`}
                                        className={cn(
                                            "absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-stone-900 transition-transform duration-150",
                                            hoveredIndex === idx ? "scale-150" : "scale-100"
                                        )}
                                        style={{
                                            left: `${point.x}%`,
                                            top: `${(point.y / chartHeight) * 100}%`
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-3 flex gap-1 text-sm font-semibold text-stone-500">
                    {displayOrder.map((rawIndex) => (
                        <div key={spec.labels[rawIndex]} className="flex-1 text-center truncate">
                            {spec.labels[rawIndex]}
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                    <span>Push the curve up or down; normalization updates below.</span>
                    <span>Total: {total}%</span>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {displayOrder.map((rawIndex) => (
                    <label key={spec.labels[rawIndex]} className="flex items-center justify-between gap-2 bg-white border border-stone-200 rounded-lg px-2 py-1">
                        <span className="truncate text-stone-600">{spec.labels[rawIndex]}</span>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            value={inputValues[rawIndex] ?? String(normalizedValues[rawIndex])}
                            onChange={(e) => {
                                const raw = e.target.value
                                setInputValues(prev => {
                                    const next = [...prev]
                                    next[rawIndex] = raw
                                    return next
                                })
                                if (raw.trim() === "") return
                                const nextValue = Math.max(0, Math.min(100, Math.round(Number(raw) || 0)))
                                const next = setRawForNormalizedTarget(rawValues, rawIndex, nextValue)
                                onRawChange(next)
                            }}
                            onFocus={(e) => {
                                setActiveInputIndex(rawIndex)
                                e.target.select()
                            }}
                            onBlur={() => {
                                setActiveInputIndex(null)
                                setInputValues(prev => {
                                    const next = [...prev]
                                    if (next[rawIndex] === "" || next[rawIndex] === undefined) {
                                        next[rawIndex] = String(normalizedValues[rawIndex] ?? 0)
                                    }
                                    return next
                                })
                            }}
                            className="w-16 rounded-md border border-stone-200 bg-white text-right text-stone-700"
                        />
                    </label>
                ))}
            </div>
        </div>
    )
}

function pointsFromValues(values: number[], chartHeight: number, maxValueOverride?: number) {
    const padding = 8
    const maxValue = maxValueOverride ?? Math.max(...values, 1)
    return values.map((value, idx) => {
        const x = (idx / Math.max(values.length - 1, 1)) * 100
        const clamped = Math.min(value, maxValue)
        const y = padding + (1 - clamped / maxValue) * (chartHeight - padding * 2)
        return { x, y }
    })
}

function mapValues(values: number[], order: number[]) {
    return order.map(index => values[index] ?? 0)
}

function getLineYAtRatio(values: number[], ratio: number, chartHeight: number) {
    const points = pointsFromValues(values, chartHeight, 100)
    if (points.length === 0) return 0
    const maxIndex = Math.max(points.length - 1, 1)
    const position = ratio * maxIndex
    const leftIndex = Math.floor(position)
    const rightIndex = Math.min(points.length - 1, leftIndex + 1)
    const left = points[leftIndex]
    const right = points[rightIndex]
    const t = rightIndex === leftIndex ? 0 : (position - leftIndex) / (rightIndex - leftIndex)
    return left.y + (right.y - left.y) * t
}

function normalizeWithFixedIndex(values: number[], index: number, targetValue: number) {
    const next = values.map(v => Math.max(0, Math.round(v)))
    const clampedTarget = Math.max(0, Math.min(100, targetValue))
    if (next.length === 1) return [100]

    const otherIndexes = next.map((_, i) => i).filter(i => i !== index)
    const otherSum = otherIndexes.reduce((sum, i) => sum + next[i], 0)
    const remaining = 100 - clampedTarget

    if (otherSum <= 0) {
        const even = Math.floor(remaining / otherIndexes.length)
        otherIndexes.forEach(i => {
            next[i] = even
        })
    } else {
        otherIndexes.forEach(i => {
            next[i] = Math.round((next[i] / otherSum) * remaining)
        })
    }

    next[index] = clampedTarget
    let total = next.reduce((sum, v) => sum + v, 0)
    let diff = 100 - total
    if (diff !== 0) {
        if (next[index] + diff >= 0 && next[index] + diff <= 100) {
            next[index] += diff
            return next
        }
        for (const i of otherIndexes) {
            const candidate = next[i] + diff
            if (candidate >= 0 && candidate <= 100) {
                next[i] = candidate
                return next
            }
        }
    }
    return next
}

function normalizeByScaling(values: number[]) {
    if (values.length === 0) return values
    const total = values.reduce((sum, v) => sum + v, 0)
    if (total <= 0) return values.map(() => 0)
    const scaled = values.map(v => (v / total) * 100)
    return normalizeDistribution(scaled)
}

function buildStepPath(points: { x: number; y: number }[]) {
    if (points.length === 0) return ""
    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
    for (let i = 1; i < points.length; i += 1) {
        const point = points[i]
        path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    }
    return path
}

function applyBrush(values: number[], index: number, targetValue: number) {
    const clampedTarget = Math.max(0, targetValue)
    const raw = [...values]
    raw[index] = clampedTarget
    return raw
}

function setRawForNormalizedTarget(values: number[], index: number, targetValue: number) {
    const clampedTarget = Math.max(0, Math.min(100, targetValue))
    if (values.length === 0) return values
    const next = [...values]

    if (clampedTarget === 100) {
        next.fill(0)
        next[index] = 1
        return next
    }

    const otherIndexes = next.map((_, i) => i).filter(i => i !== index)
    const otherSum = otherIndexes.reduce((sum, i) => sum + next[i], 0)
    if (otherSum === 0) {
        next[index] = 1
        return next
    }

    const targetRatio = clampedTarget / 100
    const newValue = (targetRatio * otherSum) / (1 - targetRatio)
    next[index] = Math.max(0, newValue)
    return next
}
