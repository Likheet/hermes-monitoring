"use client"

import { use } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { TaskVerificationView } from "@/components/task-verification-view"

interface VerifyTaskPageProps {
  params: Promise<{ taskId: string }> | { taskId: string }
}

function VerifyTaskPageContent({ params }: VerifyTaskPageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params
  return <TaskVerificationView taskId={resolvedParams.taskId} returnPath="/supervisor" />
}

export default function VerifyTaskPage(props: VerifyTaskPageProps) {
  return (
    <ProtectedRoute allowedRoles={["supervisor"]}>
      <VerifyTaskPageContent {...props} />
    </ProtectedRoute>
  )
}
