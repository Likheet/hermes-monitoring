import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export interface QueryMetric {
  name: string
  calls: number
  totalMs: number
  avgMs: number
  rows: number
}

function toMillis(value: number): number {
  return Math.round(value / 1000)
}

export async function fetchQueryMetrics(): Promise<QueryMetric[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[metrics] Missing Supabase URL or service key; skipping metric collection.")
    return []
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data, error } = await supabase.rpc("get_pg_stat_statements", {})
  if (error) {
    console.error("[metrics] Failed to load pg_stat_statements:", error)
    return []
  }

  if (!Array.isArray(data)) {
    return []
  }

  return data
    .flatMap<QueryMetric>((row) => {
      const jsonRow = row as Record<string, unknown>
      const tag = jsonRow.tag
      const totalTime = jsonRow.total_time
      const calls = jsonRow.calls
      const rowsCount = jsonRow.rows

      if (
        typeof tag === "string" &&
        typeof totalTime === "number" &&
        typeof calls === "number" &&
        typeof rowsCount === "number" &&
        calls > 0
      ) {
        const totalMs = toMillis(totalTime)
        const avgMs = calls > 0 ? Math.round(totalMs / calls) : totalMs
        return [
          {
            name: tag,
            calls,
            totalMs,
            avgMs,
            rows: rowsCount,
          },
        ]
      }

      return []
    })
    .sort((a, b) => b.totalMs - a.totalMs)
}
