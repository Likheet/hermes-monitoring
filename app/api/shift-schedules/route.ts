import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// POST/PUT - Save or update shift schedule
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    console.log("[v0] Shift schedule save request:", body)

    const {
      worker_id,
      schedule_date,
      shift_start,
      shift_end,
      has_break,
      break_start,
      break_end,
      is_override,
      override_reason,
      notes,
    } = body

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("[v0] Unauthorized: No user found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] User authenticated:", user.id)

    // Validate required fields
    if (!worker_id || !schedule_date) {
      console.error("[v0] Missing required fields:", { worker_id, schedule_date })
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
          has_break: has_break || false,
          break_start: break_start || "12:00",
          break_end: break_end || "13:00",
          is_override: is_override || false,
          override_reason: override_reason || null,
          notes: notes || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "worker_id,schedule_date",
        },
      )
      .select()
      .single()

    if (error) {
      console.error("[v0] Shift schedule save error:", error)
      return NextResponse.json({ error: error.message, details: error }, { status: 400 })
    }

    console.log("[v0] Shift schedule saved successfully:", data)

    return NextResponse.json({ schedule: data }, { status: 200 })
  } catch (error) {
    console.error("[v0] Shift schedule POST error:", error)
    return NextResponse.json({ error: "Internal server error", details: error }, { status: 500 })
  }
}

// GET - Fetch shift schedules for a worker
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const workerId = searchParams.get("worker_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
      console.error("[v0] Shift schedules fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ schedules }, { status: 200 })
  } catch (error) {
    console.error("[v0] Shift schedules GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
