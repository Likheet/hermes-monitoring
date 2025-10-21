import { NextResponse } from "next/server"

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })

    // Clear session cookie
    response.cookies.delete("session")
    response.cookies.delete("session_payload")


    return response
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
