import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyPassword } from "@/lib/auth-utils"
import { databaseUserToApp } from "@/lib/database-types"

const SESSION_COOKIE_NAME = "session"
const SESSION_PAYLOAD_COOKIE = "session_payload"

function encodeSessionPayload(payload: unknown) {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url")
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    console.log("[v0] Login attempt for username:", username)

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Query user by username
    const { data: user, error } = await supabase.from("users").select("*").eq("username", username).single()

    if (error || !user) {
      console.log("[v0] Login failed: User not found -", username, "Error:", error?.message)
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    console.log("[v0] Found user:", username, "Hash starts with:", user.password_hash?.substring(0, 10))

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)

    console.log("[v0] Password verification result:", isValid)

    if (!isValid) {
      console.log("[v0] Login failed: Invalid password for user:", username)
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    // Convert database user to app user (without password_hash)
    const appUser = databaseUserToApp(user)

    console.log("[v0] Login successful:", username, "Role:", appUser.role)

    // Create response with user data
    const response = NextResponse.json({ user: appUser })

    // Set session cookie (httpOnly for security)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    } as const

    response.cookies.set(SESSION_COOKIE_NAME, user.id, cookieOptions)
    response.cookies.set(SESSION_PAYLOAD_COOKIE, encodeSessionPayload(appUser), cookieOptions)

    return response
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
