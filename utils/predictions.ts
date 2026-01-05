export type PredictionCategory = 'highly_likely' | 'mildly_likely' | 'mildly_unlikely' | 'highly_unlikely'

export const CATEGORY_ORDER: PredictionCategory[] = [
    'highly_likely',
    'mildly_likely',
    'mildly_unlikely',
    'highly_unlikely',
]

export const CATEGORY_LABELS: Record<PredictionCategory, string> = {
    highly_likely: 'Highly Likely',
    mildly_likely: 'Likely',
    mildly_unlikely: 'Unlikely',
    highly_unlikely: 'Highly Unlikely',
}

// Pastel Full-Box Colors (Backgrounds)
export const CATEGORY_BG_COLORS: Record<PredictionCategory, string> = {
    highly_likely: 'bg-green-100 border-green-200 text-green-900',
    mildly_likely: 'bg-green-50 border-green-100 text-green-900',
    mildly_unlikely: 'bg-rose-50 border-rose-100 text-rose-900',
    highly_unlikely: 'bg-rose-100 border-rose-200 text-rose-900',
}

// Text colors for badges/labels
export const CATEGORY_COLORS: Record<PredictionCategory, string> = {
    highly_likely: 'text-green-800 bg-white/50',
    mildly_likely: 'text-green-700 bg-white/50',
    mildly_unlikely: 'text-rose-700 bg-white/50',
    highly_unlikely: 'text-rose-800 bg-white/50',
}

export function sortPredictionsByCategory<T extends { category: string }>(predictions: T[]): T[] {
    return [...predictions].sort((a, b) => {
        const indexA = CATEGORY_ORDER.indexOf(a.category as PredictionCategory)
        const indexB = CATEGORY_ORDER.indexOf(b.category as PredictionCategory)
        return indexA - indexB
    })
}
