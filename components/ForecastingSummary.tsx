'use client'

import { useEffect, useState } from "react"
import { supabase } from "@/utils/supabase"
import { Loader2 } from "lucide-react"
import {
    CATEGORY_LABELS,
    CATEGORY_COLORS,
    CATEGORY_BG_COLORS,
    PredictionCategory
} from "@/utils/predictions"
import { cn } from "@/utils/cn"

const CATEGORIES: PredictionCategory[] = ['highly_likely', 'mildly_likely', 'mildly_unlikely', 'highly_unlikely']

type PredictionRow = {
    user: { username: string }
    category: PredictionCategory
    description: string
}

export function ForecastingSummary({ year, familyId }: { year: number; familyId?: string }) {
    const [data, setData] = useState<Record<string, Record<string, string>>>({})
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<string[]>([])

    useEffect(() => {
        async function load() {
            let query = supabase
                .from('predictions')
                .select('category, description, user:users(username)')
                .eq('year', year)

            if (familyId) {
                query = query.eq('family_id', familyId)
            }

            const { data: preds } = await query

            if (preds) {
                const rows: Record<string, Record<string, string>> = {}
                const userSet = new Set<string>()

                preds.forEach((p: any) => {
                    const username = p.user.username
                    userSet.add(username)
                    if (!rows[username]) rows[username] = {}
                    rows[username][p.category] = p.description
                })

                setData(rows)
                setUsers(Array.from(userSet).sort())
            }
            setLoading(false)
        }
        load()
    }, [year, familyId])

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-stone-300" /></div>

    return (
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto rounded-xl border border-stone-200 shadow-sm">
            <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-stone-500 uppercase bg-stone-50 border-b border-stone-200">
                    <tr>
                        <th className="px-6 py-4 font-bold sticky top-0 left-0 bg-stone-50 z-20">Participant</th>
                        {CATEGORIES.map(cat => (
                            <th key={cat} className={cn("px-6 py-4 min-w-[300px] sticky top-0 z-10", CATEGORY_BG_COLORS[cat])}>
                                {CATEGORY_LABELS[cat]}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                    {users.map(username => (
                        <tr key={username} className="hover:bg-stone-50/50">
                            <td className="px-6 py-4 font-medium text-stone-900 sticky left-0 bg-white border-r border-stone-100">
                                {username}
                            </td>
                            {CATEGORIES.map(cat => (
                                <td key={cat} className="px-6 py-4 whitespace-normal min-w-[300px] align-top">
                                    {data[username]?.[cat] ? (
                                        <p className="text-stone-700 leading-snug">{data[username][cat]}</p>
                                    ) : (
                                        <span className="text-stone-300 italic text-xs">No prediction</span>
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {users.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-stone-400">
                                No forecasts submitted yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
