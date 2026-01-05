'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/utils/supabase'

type User = {
    id: string
    username: string
    pin: string | null
}

interface UserContextType {
    user: User | null
    login: (username: string) => Promise<{ success: boolean; error?: string }>
    logout: () => void
    isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Check localStorage on mount
        const storedUserId = localStorage.getItem('prediction_game_user_id')
        if (storedUserId) {
            fetchUser(storedUserId).finally(() => setIsLoading(false))
        } else {
            setIsLoading(false)
        }
    }, [])

    const fetchUser = async (id: string) => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single()

        if (data && !error) {
            setUser(data)
        } else {
            // If user not found (e.g. deleted), clear local storage
            localStorage.removeItem('prediction_game_user_id')
            setUser(null)
        }
    }

    const login = async (username: string) => {
        try {
            // Check if user exists
            let { data: existingUser, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .ilike('username', username) // Case insensitive check
                .single()

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is 'Row not found'
                return { success: false, error: fetchError.message }
            }

            if (existingUser) {
                setUser(existingUser)
                localStorage.setItem('prediction_game_user_id', existingUser.id)
                return { success: true }
            } else {
                // Create new user
                const { data: newUser, error: createError } = await supabase
                    .from('users')
                    .insert([{ username }])
                    .select()
                    .single()

                if (createError) {
                    return { success: false, error: createError.message }
                }

                if (newUser) {
                    setUser(newUser)
                    localStorage.setItem('prediction_game_user_id', newUser.id)
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
        localStorage.removeItem('prediction_game_user_id')
    }

    return (
        <UserContext.Provider value={{ user, login, logout, isLoading }}>
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
