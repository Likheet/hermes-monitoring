import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyPassword } from "@/lib/auth-utils"
import { databaseUserToApp } from "@/lib/database-types"
import { findDevAccount } from "@/lib/dev-accounts"

const SESSION_COOKIE_NAME = "session"
const SESSION_PAYLOAD_COOKIE = "session_payload"
const DEV_LOGIN_ENABLED = process.env.NEXT_PUBLIC_DEVTEST_LOGIN === "true"

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

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    }

    const supabase = await createClient()

    if (DEV_LOGIN_ENABLED) {
      const devAccount = findDevAccount(username)
      if (devAccount && devAccount.password === password) {
        const { data: dbUser, error: dbError } = await supabase
          .from("users")
          .select("*")
          .eq("username", devAccount.username)
          .maybeSingle()

        if (dbError) {
          console.error("[dev-login] Failed to load matching database user", dbError)
          return NextResponse.json({ error: "Unable to load account from database" }, { status: 500 })
        }

        if (!dbUser) {
          console.error(`[dev-login] Account ${devAccount.username} is missing from the users table`)
          return NextResponse.json({ error: "Account not provisioned in database" }, { status: 404 })
        }

        const appUser = databaseUserToApp(dbUser)
        const response = NextResponse.json({ user: appUser })
        response.cookies.set(SESSION_COOKIE_NAME, dbUser.id, cookieOptions)
        response.cookies.set(SESSION_PAYLOAD_COOKIE, encodeSessionPayload(appUser), cookieOptions)
        return response
      }
    }

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

    response.cookies.set(SESSION_COOKIE_NAME, user.id, cookieOptions)
    response.cookies.set(SESSION_PAYLOAD_COOKIE, encodeSessionPayload(appUser), cookieOptions)

    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
