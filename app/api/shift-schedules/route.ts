import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

// POST/PUT - Save or update shift schedule
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      console.error("Unauthorized: No session cookie found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionCookie.value
    const supabase = await createClient()
    const body = await request.json()


    const { worker_id, schedule_date, shift_start, shift_end, break_start, break_end, is_override, override_reason } =
      body

    // Validate required fields
    if (!worker_id || !schedule_date) {
      console.error("Missing required fields:", { worker_id, schedule_date })
      return NextResponse.json({ error: "Missing required fields: worker_id and schedule_date" }, { status: 400 })
    }

    // Upsert shift schedule
    const { data, error } = await supabase
      .from("shift_schedules")
      .upsert(
        {
          worker_id,
          schedule_date,
          shift_start: shift_start || "09:00",
          shift_end: shift_end || "17:00",
          break_start: break_start || "12:00",
          break_end: break_end || "13:00",
          is_override: is_override || false,
          override_reason: override_reason || null,
        },
        {
          onConflict: "worker_id,schedule_date",
        },
      )
      .select()
      .single()

    if (error) {
      console.error("Shift schedule save error:", error)
      return NextResponse.json({ error: error.message, details: error }, { status: 400 })
    }


    return NextResponse.json({ schedule: data }, { status: 200 })
  } catch (error) {
    console.error("Shift schedule POST error:", error)
    return NextResponse.json({ error: "Internal server error", details: error }, { status: 500 })
  }
}

// GET - Fetch shift schedules for a worker
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const workerId = searchParams.get("worker_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    let query = supabase.from("shift_schedules").select("*")

    if (workerId) {
      query = query.eq("worker_id", workerId)
    }
    if (startDate) {
      query = query.gte("schedule_date", startDate)
    }
    if (endDate) {
      query = query.lte("schedule_date", endDate)
    }

    query = query.order("schedule_date", { ascending: true })

    const { data: schedules, error } = await query

    if (error) {
      console.error("Shift schedules fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ schedules }, { status: 200, headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } })
  } catch (error) {
    console.error("Shift schedules GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
