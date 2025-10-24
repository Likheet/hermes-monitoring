import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { validateDualShiftTimes } from "@/lib/shift-utils"

// POST/PUT - Save or update shift schedule
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      console.error("Unauthorized: No session cookie found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const body = await request.json()

    const {
      worker_id,
      schedule_date,
      // Legacy single shift fields
      shift_start,
      shift_end,
      break_start,
      break_end,
      // Dual shift fields
      shift_1_start,
      shift_1_end,
      shift_1_break_start,
      shift_1_break_end,
      shift_2_start,
      shift_2_end,
      shift_2_break_start,
      shift_2_break_end,
      has_shift_2,
      is_dual_shift,
      is_override,
      override_reason,
      notes,
    } = body

    // Validate required fields
    if (!worker_id || !schedule_date) {
      console.error("Missing required fields:", { worker_id, schedule_date })
      return NextResponse.json({ error: "Missing required fields: worker_id and schedule_date" }, { status: 400 })
    }

    const shift1Start = shift_1_start ?? shift_start ?? null
    const shift1End = shift_1_end ?? shift_end ?? null
    const shift1BreakStartRaw = shift_1_break_start ?? break_start ?? null
    const shift1BreakEndRaw = shift_1_break_end ?? break_end ?? null

    const shift1BreakStart =
      shift1BreakStartRaw && shift1BreakEndRaw ? shift1BreakStartRaw : null
    const shift1BreakEnd =
      shift1BreakStartRaw && shift1BreakEndRaw ? shift1BreakEndRaw : null

    const shift2Start = shift_2_start ?? null
    const shift2End = shift_2_end ?? null
    const shift2BreakStartRaw = shift_2_break_start ?? null
    const shift2BreakEndRaw = shift_2_break_end ?? null
    const shift2BreakStart =
      shift2BreakStartRaw && shift2BreakEndRaw ? shift2BreakStartRaw : null
    const shift2BreakEnd =
      shift2BreakStartRaw && shift2BreakEndRaw ? shift2BreakEndRaw : null

    const dualShiftRequested = Boolean(is_dual_shift || has_shift_2 || (shift2Start && shift2End))
    const overrideOffDuty =
      Boolean(is_override) && !shift1Start && !shift1End && !shift2Start && !shift2End

    if (!overrideOffDuty) {
      if (!shift1Start || !shift1End) {
        return NextResponse.json(
          { error: "Shift 1 start and end times are required" },
          { status: 400 },
        )
      }

      if ((shift1BreakStart && !shift1BreakEnd) || (!shift1BreakStart && shift1BreakEnd)) {
        return NextResponse.json(
          { error: "Shift 1 break requires both start and end times" },
          { status: 400 },
        )
      }

      if ((shift2BreakStart && !shift2BreakEnd) || (!shift2BreakStart && shift2BreakEnd)) {
        return NextResponse.json(
          { error: "Shift 2 break requires both start and end times" },
          { status: 400 },
        )
      }

      if (dualShiftRequested && (!shift2Start || !shift2End)) {
        return NextResponse.json(
          { error: "Shift 2 start and end times are required when configuring a dual shift" },
          { status: 400 },
        )
      }

      const validation = validateDualShiftTimes(
        shift1Start,
        shift1End,
        shift1BreakStart ?? undefined,
        shift1BreakEnd ?? undefined,
        dualShiftRequested ? shift2Start ?? undefined : undefined,
        dualShiftRequested ? shift2End ?? undefined : undefined,
        dualShiftRequested ? shift2BreakStart ?? undefined : undefined,
        dualShiftRequested ? shift2BreakEnd ?? undefined : undefined,
      )

      if (!validation.valid) {
        return NextResponse.json({ error: validation.error ?? "Invalid shift configuration" }, { status: 400 })
      }
    }

    const payload = {
      worker_id,
      schedule_date,
      shift_start: overrideOffDuty ? null : shift1Start,
      shift_end: overrideOffDuty ? null : shift1End,
      break_start: overrideOffDuty ? null : shift1BreakStart,
      break_end: overrideOffDuty ? null : shift1BreakEnd,
      shift_1_start: overrideOffDuty ? null : shift1Start,
      shift_1_end: overrideOffDuty ? null : shift1End,
      shift_1_break_start: overrideOffDuty ? null : shift1BreakStart,
      shift_1_break_end: overrideOffDuty ? null : shift1BreakEnd,
      shift_2_start: overrideOffDuty || !dualShiftRequested ? null : shift2Start,
      shift_2_end: overrideOffDuty || !dualShiftRequested ? null : shift2End,
      shift_2_break_start: overrideOffDuty || !dualShiftRequested ? null : shift2BreakStart,
      shift_2_break_end: overrideOffDuty || !dualShiftRequested ? null : shift2BreakEnd,
      has_shift_2: overrideOffDuty ? false : Boolean(dualShiftRequested),
      is_dual_shift: overrideOffDuty ? false : Boolean(dualShiftRequested),
      is_override: Boolean(is_override),
      override_reason: override_reason ? String(override_reason) : null,
      notes:
        typeof notes === "string" && notes.trim().length > 0
          ? notes.trim()
          : null,
    }

    const { data, error } = await supabase
      .from("shift_schedules")
      .upsert(payload, {
        onConflict: "worker_id,schedule_date",
      })
      .select()
      .single()

    if (error) {
      console.error("Shift schedule save error:", error)
      console.log("[v0] DEBUG: Save error details:", {
        errorCode: error.code,
        errorMessage: error.message,
        details: error.details,
        payload: payload
      })
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

    return NextResponse.json(
      { schedules },
      { status: 200, headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
    )
  } catch (error) {
    console.error("Shift schedules GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
