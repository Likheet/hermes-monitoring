"use client"

import { Badge } from "@/components/ui/badge"
import { AlertTriangle, AlertCircle, AlertOctagon } from "lucide-react"
import { getEscalationColor, getEscalationLabel } from "@/lib/escalation-utils"

interface EscalationBadgeProps {
  level: 1 | 2 | 3
  showLabel?: boolean
}

export function EscalationBadge({ level, showLabel = true }: EscalationBadgeProps) {
  const Icon = level === 1 ? AlertTriangle : level === 2 ? AlertCircle : AlertOctagon

  return (
    <Badge className={`${getEscalationColor(level)} flex items-center gap-1`} variant="secondary">
      <Icon className="h-3 w-3" />
      {showLabel && getEscalationLabel(level)}
    </Badge>
  )
}
