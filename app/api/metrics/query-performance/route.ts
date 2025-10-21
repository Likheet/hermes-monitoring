import { NextResponse } from "next/server"
import { fetchQueryMetrics } from "@/lib/server/supabase-metrics"

export async function GET() {
  try {
    const metrics = await fetchQueryMetrics()

    return NextResponse.json(
      {
        metrics,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      },
    )
  } catch (error) {
    console.error("[metrics] Failed to produce query metrics:", error)
    return NextResponse.json({ error: "Unable to load query metrics" }, { status: 500 })
  }
}
