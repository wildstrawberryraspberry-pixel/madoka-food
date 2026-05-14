import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jjfapdomwrkeenswotoc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZmFwZG9td3JrZWVuc3dvdG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3Mjc4NzksImV4cCI6MjA5NDMwMzg3OX0.0A6us1WmTchQqVm5Kw4F-toCvKshrrc32iQ2AY4NEK4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
