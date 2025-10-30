"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"

export default function LegacyWorkerNotesPage() {
  redirect("/worker")
}
import { formatDistanceToNow } from "@/lib/date-utils"
