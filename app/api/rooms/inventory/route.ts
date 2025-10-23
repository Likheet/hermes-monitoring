import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { ALL_ROOMS } from "@/lib/location-data"

type InventoryRow = {
  room_number?: string | null
  status?: string | null
  block?: string | null
  floor?: number | null
  room_type?: string | null
  is_active?: boolean | null
}

function buildFallbackRooms() {
  return ALL_ROOMS.map((room) => ({
    room_number: room.number,
    status: "available",
    block: room.block,
    floor: room.floor,
    room_type: room.type,
  }))
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionUserId = cookieStore.get("session")?.value

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("room_inventory")
      .select("room_number,status,block,floor,room_type,is_active")
      .order("room_number")

    if (error) {
      console.warn("[rooms] Unable to load inventory from Supabase:", error)
      return NextResponse.json({ rooms: buildFallbackRooms(), source: "fallback" }, { status: 200 })
    }

    const rows = (data ?? []) as InventoryRow[]
    if (rows.length === 0) {
      return NextResponse.json({ rooms: buildFallbackRooms(), source: "fallback" }, { status: 200 })
    }

    const rooms = rows
      .filter((row) => {
        if (!row.room_number) {
          return false
        }
        if (row.is_active === false) {
          return false
        }
        return true
      })
      .map((row) => {
        const trimmedRoom = row.room_number?.trim() ?? ""
        const canonical = ALL_ROOMS.find((candidate) => candidate.number === trimmedRoom)
        return {
          room_number: trimmedRoom,
          status: (row.status ?? "unknown").toLowerCase(),
          block: canonical?.block ?? (row.block ?? undefined),
          floor: canonical?.floor ?? row.floor ?? undefined,
          room_type: canonical?.type ?? (row.room_type ?? undefined),
        }
      })

    if (rooms.length === 0) {
      return NextResponse.json({ rooms: buildFallbackRooms(), source: "fallback" }, { status: 200 })
    }

    return NextResponse.json(
      { rooms, source: "supabase" },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (error) {
    console.error("[rooms] Failed to load inventory:", error)
    return NextResponse.json({ rooms: buildFallbackRooms(), source: "fallback" }, { status: 200 })
  }
}
