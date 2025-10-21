import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { databaseUserToApp } from "@/lib/database-types"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, name, role, phone, department, shift_timing, created_at")
      .order("name", { ascending: true })

    if (error) {
      console.error("Users fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const appUsers = users.map(databaseUserToApp)

    return NextResponse.json({ users: appUsers }, { status: 200, headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } })
  } catch (error) {
    console.error("Users GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data: user, error } = await supabase
      .from("users")
      .insert(body)
      .select("id, username, name, role, phone, department, shift_timing, created_at")
      .single()

    if (error) {
      console.error("User creation error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const appUser = databaseUserToApp(user)

    return NextResponse.json({ user: appUser }, { status: 201 })
  } catch (error) {
    console.error("User POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
