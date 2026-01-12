'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/utils/supabase'

type Family = {
    id: string
    name: string
    pin: string
}

type User = {
    id: string
    username: string
    pin: string | null
    family_id: string | null
}

interface UserContextType {
    user: User | null
    family: Family | null
    families: Family[]
    login: (username: string, familyId: string) => Promise<{ success: boolean; error?: string }>
    logout: () => void
    switchFamily: (familyId: string) => void
    refreshFamilies: () => Promise<void>
    adminPin: string
    refreshAdminPin: () => Promise<void>
    updateAdminPin: (newPin: string) => Promise<{ success: boolean; error?: string }>
    isGuest: boolean
    isLoading: boolean
    isViewingOtherFamily: boolean
    viewingFamily: Family | null
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [family, setFamily] = useState<Family | null>(null)
    const [families, setFamilies] = useState<Family[]>([])
    const [viewingFamily, setViewingFamily] = useState<Family | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [adminPin, setAdminPin] = useState("2647")
    const [isGuest, setIsGuest] = useState(false)

    // Computed: are we viewing a different family than our own?
    const isViewingOtherFamily = viewingFamily !== null && viewingFamily.id !== family?.id

    useEffect(() => {
        // Load families list
        loadFamilies()
        refreshAdminPin()

        // Check localStorage on mount
        const storedUserId = localStorage.getItem('prediction_game_user_id')
        const storedFamilyId = localStorage.getItem('prediction_game_family_id')

        if (storedUserId && storedFamilyId) {
            if (storedUserId === 'guest') {
                setUser({ id: 'guest', username: 'Guest', pin: null, family_id: null })
                setFamily(null)
                const initialFamily = families.find(f => f.id === storedFamilyId) || families[0] || null
                setViewingFamily(initialFamily)
                setIsGuest(true)
                setIsLoading(false)
            } else {
                fetchUserAndFamily(storedUserId, storedFamilyId).finally(() => setIsLoading(false))
            }
        } else {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (isGuest && !viewingFamily && families.length > 0) {
            setViewingFamily(families[0])
            localStorage.setItem('prediction_game_family_id', families[0].id)
        }
    }, [isGuest, viewingFamily, families])

    const loadFamilies = async () => {
        const { data } = await supabase
            .from('families')
            .select('*')
            .order('name')

        if (data) {
            setFamilies(data)
        }
        return data || []
    }

    const refreshFamilies = async () => {
        const data = await loadFamilies()
        if (data.length === 0) {
            setFamily(null)
            setViewingFamily(null)
            return
        }

        if (family && !data.find(f => f.id === family.id)) {
            setFamily(null)
        } else if (family) {
            const updatedFamily = data.find(f => f.id === family.id)
            if (updatedFamily) {
                setFamily(updatedFamily)
            }
        }

        if (viewingFamily && !data.find(f => f.id === viewingFamily.id)) {
            setViewingFamily(data[0])
        } else if (viewingFamily) {
            const updatedViewing = data.find(f => f.id === viewingFamily.id)
            if (updatedViewing) {
                setViewingFamily(updatedViewing)
            }
        }

        if (!viewingFamily && data[0]) {
            setViewingFamily(data[0])
        }
    }

    const refreshAdminPin = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'admin_pin')
                .single()

            if (error && error.code !== 'PGRST116') {
                return
            }

            if (data?.value) {
                setAdminPin(data.value)
            }
        } catch (err) {
            return
        }
    }

    const updateAdminPin = async (newPin: string) => {
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({ key: 'admin_pin', value: newPin }, { onConflict: 'key' })

            if (error) {
                return { success: false, error: error.message }
            }

            setAdminPin(newPin)
            return { success: true }
        } catch (err) {
            return { success: false, error: "Network error" }
        }
    }

    const fetchUserAndFamily = async (userId: string, familyId: string) => {
        const [userRes, familyRes] = await Promise.all([
            supabase.from('users').select('*').eq('id', userId).single(),
            supabase.from('families').select('*').eq('id', familyId).single()
        ])

        if (userRes.data && !userRes.error) {
            setUser(userRes.data)
        } else {
            localStorage.removeItem('prediction_game_user_id')
            localStorage.removeItem('prediction_game_family_id')
            setUser(null)
        }

        if (familyRes.data && !familyRes.error) {
            setFamily(familyRes.data)
            setViewingFamily(familyRes.data) // Start viewing own family
        } else {
            setFamily(null)
        }
    }

    const login = async (username: string, familyId: string) => {
        try {
            if (familyId === 'guest') {
                const defaultFamily = families[0] || null
                setUser({ id: 'guest', username: 'Guest', pin: null, family_id: null })
                setFamily(null)
                setViewingFamily(defaultFamily)
                setIsGuest(true)
                localStorage.setItem('prediction_game_user_id', 'guest')
                if (defaultFamily) {
                    localStorage.setItem('prediction_game_family_id', defaultFamily.id)
                } else {
                    localStorage.removeItem('prediction_game_family_id')
                }
                return { success: true }
            }

            // Find the family
            const { data: familyData, error: familyError } = await supabase
                .from('families')
                .select('*')
                .eq('id', familyId)
                .single()

            if (familyError || !familyData) {
                return { success: false, error: "Family not found" }
            }

            // Check if user exists in this family
            let { data: existingUser, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .ilike('username', username)
                .eq('family_id', familyId)
                .single()

            if (fetchError && fetchError.code !== 'PGRST116') {
                return { success: false, error: fetchError.message }
            }

            if (existingUser) {
                    setUser(existingUser)
                    setFamily(familyData)
                    setViewingFamily(familyData)
                    setIsGuest(false)
                    localStorage.setItem('prediction_game_user_id', existingUser.id)
                    localStorage.setItem('prediction_game_family_id', familyData.id)
                    return { success: true }
                } else {
                // Create new user in this family
                const { data: newUser, error: createError } = await supabase
                    .from('users')
                    .insert([{ username, family_id: familyId }])
                    .select()
                    .single()

                if (createError) {
                    return { success: false, error: createError.message }
                }

                if (newUser) {
                    setUser(newUser)
                    setFamily(familyData)
                    setViewingFamily(familyData)
                    setIsGuest(false)
                    localStorage.setItem('prediction_game_user_id', newUser.id)
                    localStorage.setItem('prediction_game_family_id', familyData.id)
                    return { success: true }
                }
            }

            return { success: false, error: "Unknown error" }
        } catch (err) {
            return { success: false, error: "Network error" }
        }
    }

    const logout = () => {
        setUser(null)
        setFamily(null)
        setViewingFamily(null)
        setIsGuest(false)
        localStorage.removeItem('prediction_game_user_id')
        localStorage.removeItem('prediction_game_family_id')
    }

    const switchFamily = (familyId: string) => {
        const targetFamily = families.find(f => f.id === familyId)
        if (targetFamily) {
            setViewingFamily(targetFamily)
            if (isGuest) {
                localStorage.setItem('prediction_game_family_id', targetFamily.id)
            }
        }
    }

    return (
        <UserContext.Provider value={{
            user,
            family,
            families,
            login,
            logout,
            switchFamily,
            refreshFamilies,
            adminPin,
            refreshAdminPin,
            updateAdminPin,
            isGuest,
            isLoading,
            isViewingOtherFamily,
            viewingFamily
        }}>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    const context = useContext(UserContext)
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider')
    }
    return context
}
