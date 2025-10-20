import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseUserToApp } from "@/lib/database-types"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("session")?.value

    if (!sessionId) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const supabase = await createClient()

    const { data: user, error } = await supabase.from("users").select("*").eq("id", sessionId).single()

    if (error || !user) {
      console.error("[v0] Session validation error:", error)
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const appUser = databaseUserToApp(user)

    return NextResponse.json({ user: appUser }, { status: 200 })
  } catch (error) {
    console.error("[v0] Session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
