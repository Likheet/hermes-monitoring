"use client"

import { use } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { TaskVerificationView } from "@/components/task-verification-view"

interface FrontOfficeVerifyTaskPageProps {
  params: Promise<{ taskId: string }> | { taskId: string }
}

function FrontOfficeVerifyTaskPageContent({ params }: FrontOfficeVerifyTaskPageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params
  return <TaskVerificationView taskId={resolvedParams.taskId} returnPath="/front-office?tab=supervisor" />
}

export default function FrontOfficeVerifyTaskPage(props: FrontOfficeVerifyTaskPageProps) {
  return (
    <ProtectedRoute allowedRoles={["front_office", "supervisor", "admin"]}>
      <FrontOfficeVerifyTaskPageContent {...props} />
    </ProtectedRoute>
  )
}
