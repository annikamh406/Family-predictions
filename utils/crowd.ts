export type CrowdEventType = 'by_year' | 'by_deadline'
export type SnapshotCadence = 'weekly' | 'monthly'
export type DateGranularity = 'yearly' | 'quarterly' | 'monthly'

export type CrowdEvent = {
    id: string
    title: string
    description: string | null
    type: CrowdEventType
    status: 'open' | 'resolved' | 'closed'
    created_by: string | null
    snapshot_cadence: SnapshotCadence
    date_granularity: DateGranularity | null
    min_year: number | null
    max_year: number | null
    target_date: string | null
    resolution: any | null
    created_at: string
    updated_at: string
    deleted_at: string | null
}

export type CrowdForecast = {
    id: string
    event_id: string
    user_id: string
    distribution: number[]
    created_at: string
    updated_at: string
}

export type CrowdSnapshot = {
    id: string
    event_id: string
    snapshot_at: string
    distribution: number[]
    created_at: string
}

export type BinSpec = {
    labels: string[]
    bucketCount: number
    hasNever: boolean
}

export function getBinSpec(event: CrowdEvent): BinSpec {
    switch (event.type) {
        case 'by_deadline': {
            const labels: string[] = []
            for (let i = 0; i < 100; i += 5) {
                labels.push(`${i}-${i + 5}%`)
            }
            return { labels, bucketCount: labels.length, hasNever: false }
        }
        case 'by_year': {
            const labels = buildYearLabels(event.min_year, event.max_year)
            labels.push('Never')
            return { labels, bucketCount: labels.length, hasNever: true }
        }
        default:
            return { labels: [], bucketCount: 0, hasNever: false }
    }
}

export function buildDefaultDistribution(event: CrowdEvent): number[] {
    const spec = getBinSpec(event)
    if (spec.bucketCount === 0) return []
    const base = Math.floor(100 / spec.bucketCount)
    const remainder = 100 - base * spec.bucketCount
    const values = new Array(spec.bucketCount).fill(base)
    for (let i = 0; i < remainder; i += 1) values[i] += 1
    return values
}

export function normalizeDistribution(values: number[]): number[] {
    if (values.length === 0) return values
    const rounded = values.map(v => Math.max(0, Math.round(v)))
    let total = rounded.reduce((sum, v) => sum + v, 0)
    const target = 100
    if (total === target) return rounded

    const sorted = rounded
        .map((v, idx) => ({ v, idx }))
        .sort((a, b) => b.v - a.v)

    let i = 0
    while (total !== target && sorted.length > 0) {
        const entry = sorted[i % sorted.length]
        if (total > target && rounded[entry.idx] > 0) {
            rounded[entry.idx] -= 1
            total -= 1
        } else if (total < target) {
            rounded[entry.idx] += 1
            total += 1
        }
        i += 1
    }
    return rounded
}

export function adjustDistribution(values: number[], index: number, delta: number): number[] {
    if (values.length === 0) return values
    const next = [...values]
    next[index] = Math.max(0, Math.min(100, next[index] + delta))

    let total = next.reduce((sum, v) => sum + v, 0)
    const target = 100
    if (total === target) return normalizeDistribution(next)

    const otherIndexes = next.map((_, i) => i).filter(i => i !== index)
    const otherTotal = otherIndexes.reduce((sum, i) => sum + next[i], 0)

    if (otherTotal <= 0) {
        next[index] = Math.max(0, Math.min(100, next[index] - (total - target)))
        return normalizeDistribution(next)
    }

    const diff = total - target
    otherIndexes.forEach(i => {
        const share = next[i] / otherTotal
        next[i] = next[i] - diff * share
    })
    return normalizeDistribution(next)
}

export function setDistributionValue(values: number[], index: number, nextValue: number): number[] {
    if (values.length === 0) return values
    const clipped = Math.max(0, Math.min(100, Math.round(nextValue)))
    const delta = clipped - values[index]
    return adjustDistribution(values, index, delta)
}

export function getSnapshotDate(cadence: SnapshotCadence, now = new Date()): string {
    const date = new Date(now)
    if (cadence === 'weekly') {
        const day = date.getDay() || 7
        date.setDate(date.getDate() - (day - 1))
    } else {
        date.setDate(1)
    }
    date.setHours(0, 0, 0, 0)
    return date.toISOString().slice(0, 10)
}

export function formatSnapshotLabel(dateStr: string, cadence: SnapshotCadence): string {
    const date = new Date(`${dateStr}T00:00:00`)
    if (cadence === 'weekly') {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function eventTypeLabel(type: CrowdEventType): string {
    switch (type) {
        case 'by_year':
            return 'Year of occurrence'
        case 'by_deadline':
            return 'By deadline'
        default:
            return 'Forecast event'
    }
}

function buildYearLabels(minYear: number | null, maxYear: number | null): string[] {
    const start = minYear || new Date().getFullYear()
    const end = maxYear && maxYear >= start ? maxYear : start + 5
    const labels: string[] = []
    for (let year = start; year <= end; year += 1) labels.push(String(year))
    return labels
}
