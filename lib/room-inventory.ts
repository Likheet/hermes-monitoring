import { ALL_ROOMS, type RoomData } from "./location-data"

export type RoomStatus = "available" | "vacant" | "occupied" | "dirty" | "maintenance" | "blocked" | "unknown" | string

export interface RoomInventoryItem {
  roomNumber: string
  status: RoomStatus
  block?: RoomData["block"]
  floor?: RoomData["floor"]
  type?: RoomData["type"]
}

type ApiRoomPayload = {
  room_number?: string | null
  status?: string | null
  block?: string | null
  floor?: number | null
  room_type?: string | null
}

const FALLBACK_ROOMS: RoomInventoryItem[] = ALL_ROOMS.map((room) => ({
  roomNumber: room.number,
  status: "available",
  block: room.block,
  floor: room.floor,
  type: room.type,
}))

function sanitizeRoomPayload(room: ApiRoomPayload): RoomInventoryItem | null {
  const roomNumber = (room.room_number ?? "").trim()
  if (!roomNumber) {
    return null
  }

  const canonical = ALL_ROOMS.find((candidate) => candidate.number === roomNumber)

  return {
    roomNumber,
    status: (room.status ?? "unknown").toLowerCase(),
    block: canonical?.block ?? (room.block as RoomData["block"] | undefined),
    floor: canonical?.floor ?? room.floor ?? undefined,
    type: canonical?.type ?? (room.room_type as RoomData["type"] | undefined),
  }
}

export async function fetchActiveRoomInventory(): Promise<RoomInventoryItem[]> {
  try {
    const response = await fetch("/api/rooms/inventory", { cache: "no-store" })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = (await response.json()) as { rooms?: ApiRoomPayload[] | null }
    if (!payload?.rooms || !Array.isArray(payload.rooms)) {
      return FALLBACK_ROOMS
    }

    const sanitized = payload.rooms
      .map((room) => sanitizeRoomPayload(room))
      .filter((room): room is RoomInventoryItem => Boolean(room))

    return sanitized.length > 0 ? sanitized : FALLBACK_ROOMS
  } catch (error) {
    console.warn("[room-inventory] Falling back to static room list:", error)
    return FALLBACK_ROOMS
  }
}
