"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertTriangle } from "lucide-react"

interface RaiseIssueModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (issueDescription: string) => void
}

export function RaiseIssueModal({ open, onOpenChange, onSubmit }: RaiseIssueModalProps) {
  const [issueDescription, setIssueDescription] = useState("")

  const handleSubmit = () => {
    if (!issueDescription.trim()) return

    onSubmit(issueDescription)
    setIssueDescription("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Raise Issue
          </DialogTitle>
          <DialogDescription>
            Describe the issue you're facing with this task. This will be sent to both supervisor and front office.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="issue">Issue Description</Label>
            <Textarea
              id="issue"
              placeholder="Describe the issue in detail..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={5}
              className="mt-2"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!issueDescription.trim()}>
              Submit Issue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
