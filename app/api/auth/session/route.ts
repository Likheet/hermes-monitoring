import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseUserToApp } from "@/lib/database-types"

const SESSION_COOKIE_NAME = "session"
const SESSION_PAYLOAD_COOKIE = "session_payload"
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
}

function normalizeBase64Url(value: string) {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4
  if (padding === 2) normalized += "=="
  else if (padding === 3) normalized += "="
  else if (padding !== 0) normalized += "==="
  return normalized
}

function decodeSessionPayload(value: string | undefined) {
  if (!value) return null

  try {
    const decoded = Buffer.from(normalizeBase64Url(value), "base64").toString("utf-8")
    return JSON.parse(decoded)
  } catch (error) {
    console.warn("Failed to decode session payload cookie, falling back to database lookup", error)
    return null
  }
}

function encodeSessionPayload(payload: unknown) {
  const base64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64")
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionId) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const cachedUser = decodeSessionPayload(cookieStore.get(SESSION_PAYLOAD_COOKIE)?.value)
    if (cachedUser) {
      return NextResponse.json({ user: cachedUser }, { status: 200 })
    }

    const supabase = await createClient()

    const { data: user, error } = await supabase.from("users").select("*").eq("id", sessionId).single()

    if (error || !user) {
      console.error("Session validation error:", error)
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const appUser = databaseUserToApp(user)
    const response = NextResponse.json({ user: appUser }, { status: 200 })
    response.cookies.set(SESSION_PAYLOAD_COOKIE, encodeSessionPayload(appUser), SESSION_COOKIE_OPTIONS)

    return response
  } catch (error) {
    console.error("Session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
