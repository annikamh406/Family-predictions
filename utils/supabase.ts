
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. The app will not function correctly until they are set.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
