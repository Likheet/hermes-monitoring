export interface RoomData {
  number: string
  block: "A" | "B"
  floor: number
  type: "1BHK" | "2BHK"
}

export interface CommonAreaData {
  name: string
  keywords: string[]
}

const A_BLOCK_ROOMS: RoomData[] = []
for (const floor of [5, 6, 7]) {
  for (let room = 1; room <= 20; room++) {
    const roomNumber = room < 10 ? `${floor}0${room}` : `${floor}${room}`
    A_BLOCK_ROOMS.push({
      number: roomNumber,
      block: "A",
      floor,
      type: "1BHK",
    })
  }
}

const B_BLOCK_ROOMS: RoomData[] = []
for (let floor = 1; floor <= 7; floor++) {
  // 1BHK rooms: 1101, 1102, 1103, 1105, 1201, 1202, etc.
  for (const room of [1, 2, 3, 5]) {
    const roomNumber = `1${floor}0${room}`
    B_BLOCK_ROOMS.push({
      number: roomNumber,
      block: "B",
      floor,
      type: "1BHK",
    })
  }

  // 2BHK rooms: 2104, 2106, 2204, 2206, etc.
  for (const room of [4, 6]) {
    const roomNumber = `2${floor}0${room}`
    B_BLOCK_ROOMS.push({
      number: roomNumber,
      block: "B",
      floor,
      type: "2BHK",
    })
  }
}

export const ALL_ROOMS: RoomData[] = [...A_BLOCK_ROOMS, ...B_BLOCK_ROOMS]

export interface LiftData {
  id: string
  name: string
  block: "A" | "B"
}

export const ALL_LIFTS: LiftData[] = [
  { id: "lift-a-a", name: "Lift-A (Block A)", block: "A" },
  { id: "lift-b-a", name: "Lift-B (Block A)", block: "A" },
  { id: "lift-a-b", name: "Lift-A (Block B)", block: "B" },
  { id: "lift-b-b", name: "Lift-B (Block B)", block: "B" },
]

export const COMMON_AREAS: CommonAreaData[] = [
  { name: "Pool", keywords: ["pool", "swimming", "waterpark"] },
  { name: "Lobby", keywords: ["lobby", "entrance"] },
  { name: "Reception", keywords: ["reception", "front desk"] },
  { name: "Restaurant", keywords: ["restaurant", "dining"] },
  { name: "Banquet Hall", keywords: ["banquet", "hall", "event"] },
  { name: "Public Toilet", keywords: ["toilet", "bathroom", "restroom"] },
  { name: "Porch", keywords: ["porch", "ramp"] },
  { name: "Lawn", keywords: ["lawn", "garden", "grass"] },
  { name: "Kid's Play Area", keywords: ["kids", "play", "playground"] },
  { name: "A Block Corridor", keywords: ["corridor", "hallway", "a block"] },
  { name: "B Block Corridor", keywords: ["corridor", "hallway", "b block"] },
  { name: "A Block Guest Staircase", keywords: ["staircase", "stairs", "a block", "guest"] },
  { name: "A Block Staff Staircase", keywords: ["staircase", "stairs", "a block", "staff"] },
  { name: "B Block Guest Staircase", keywords: ["staircase", "stairs", "b block", "guest"] },
  { name: "B Block Staff Staircase", keywords: ["staircase", "stairs", "b block", "staff"] },
  { name: "B Block Lobby", keywords: ["lobby", "b block"] },
  { name: "Lift Lobby", keywords: ["lift", "lobby", "elevator"] },
  { name: "Indoor Games Area", keywords: ["games", "indoor"] },
  { name: "Parking", keywords: ["parking", "internal roads"] },
]

export const ALL_LOCATIONS = [
  ...ALL_ROOMS.map((room) => ({
    value: room.number,
    label: `Room ${room.number} (${room.type})`,
    type: "room" as const,
    data: room,
  })),
  ...COMMON_AREAS.map((area) => ({ value: area.name, label: area.name, type: "area" as const, data: area })),
]

export interface MaintenanceItem {
  type: "ac_indoor" | "ac_outdoor" | "fan" | "exhaust"
  location: string
  description: string
}

export function getMaintenanceItemsForRoom(roomNumber: string): MaintenanceItem[] {
  const room = ALL_ROOMS.find((r) => r.number === roomNumber)
  if (!room) return []

  const items: MaintenanceItem[] = []

  if (room.type === "1BHK") {
    // 1BHK: 1 Hall + 1 Bedroom
    items.push(
      { type: "ac_indoor", location: "Hall", description: "AC Indoor Unit (Hall)" },
      { type: "ac_indoor", location: "Bedroom", description: "AC Indoor Unit (Bedroom)" },
      { type: "ac_outdoor", location: "Hall AC Outdoor", description: "AC Outdoor Unit (Hall)" },
      { type: "ac_outdoor", location: "Bedroom AC Outdoor", description: "AC Outdoor Unit (Bedroom)" },
      { type: "fan", location: "Hall", description: "Fan (Hall)" },
      { type: "fan", location: "Bedroom", description: "Fan (Bedroom)" },
      { type: "exhaust", location: "Bedroom", description: "Exhaust Fan (Bedroom)" },
    )
  } else {
    // 2BHK: 1 Hall + 2 Bedrooms
    items.push(
      { type: "ac_indoor", location: "Hall", description: "AC Indoor Unit (Hall)" },
      { type: "ac_indoor", location: "Bedroom 1", description: "AC Indoor Unit (Bedroom 1)" },
      { type: "ac_indoor", location: "Bedroom 2", description: "AC Indoor Unit (Bedroom 2)" },
      { type: "ac_outdoor", location: "Hall AC Outdoor", description: "AC Outdoor Unit (Hall)" },
      { type: "ac_outdoor", location: "Bedroom 1 AC Outdoor", description: "AC Outdoor Unit (Bedroom 1)" },
      { type: "ac_outdoor", location: "Bedroom 2 AC Outdoor", description: "AC Outdoor Unit (Bedroom 2)" },
      { type: "fan", location: "Hall", description: "Fan (Hall)" },
      { type: "fan", location: "Bedroom 1", description: "Fan (Bedroom 1)" },
      { type: "fan", location: "Bedroom 2", description: "Fan (Bedroom 2)" },
      { type: "exhaust", location: "Bedroom 1", description: "Exhaust Fan (Bedroom 1)" },
      { type: "exhaust", location: "Bedroom 2", description: "Exhaust Fan (Bedroom 2)" },
    )
  }

  return items
}

export function getACLocationsForRoom(roomNumber: string): string[] {
  const room = ALL_ROOMS.find((r) => r.number === roomNumber)
  if (!room) return []

  if (room.type === "1BHK") {
    return ["Hall", "Bedroom"]
  } else {
    return ["Hall", "Bedroom 1", "Bedroom 2"]
  }
}
