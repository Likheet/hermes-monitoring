import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyPassword } from "@/lib/auth-utils"
import { databaseUserToApp } from "@/lib/database-types"

const SESSION_COOKIE_NAME = "session"
const SESSION_PAYLOAD_COOKIE = "session_payload"

function encodeSessionPayload(payload: unknown) {
  const base64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64")
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()


    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Query user by username
    const { data: user, error } = await supabase.from("users").select("*").eq("username", username).single()

    if (error || !user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }


    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)


    if (!isValid) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    // Convert database user to app user (without password_hash)
    const appUser = databaseUserToApp(user)


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
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
