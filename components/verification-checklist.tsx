"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface VerificationChecklistProps {
  onChecklistComplete: (completed: boolean) => void
}

export function VerificationChecklist({ onChecklistComplete }: VerificationChecklistProps) {
  const [physicallyVerified, setPhysicallyVerified] = useState(false)

  const handleCheckChange = (checked: boolean) => {
    setPhysicallyVerified(checked)
    onChecklistComplete(checked)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification Checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Checkbox id="physical-verification" checked={physicallyVerified} onCheckedChange={handleCheckChange} />
          <Label
            htmlFor="physical-verification"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Did you physically go and see the completed task?
          </Label>
        </div>
      </CardContent>
    </Card>
  )
}
