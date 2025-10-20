import { createBrowserClient } from "@supabase/ssr"

export { createBrowserClient }

let browserSupabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (browserSupabaseClient) {
    return browserSupabaseClient
  }

  browserSupabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  return browserSupabaseClient
}
