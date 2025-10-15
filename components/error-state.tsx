"use client"

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  type?: "error" | "offline" | "not-found"
}

export function ErrorState({ title, message, onRetry, type = "error" }: ErrorStateProps) {
  const getIcon = () => {
    switch (type) {
      case "offline":
        return <WifiOff className="h-12 w-12 text-muted-foreground" />
      case "not-found":
        return <AlertCircle className="h-12 w-12 text-muted-foreground" />
      default:
        return <AlertCircle className="h-12 w-12 text-destructive" />
    }
  }

  const getDefaultTitle = () => {
    switch (type) {
      case "offline":
        return "You're offline"
      case "not-found":
        return "Not found"
      default:
        return "Something went wrong"
    }
  }

  const getDefaultMessage = () => {
    switch (type) {
      case "offline":
        return "Please check your internet connection and try again"
      case "not-found":
        return "The page or resource you're looking for doesn't exist"
      default:
        return "An error occurred while loading this content"
    }
  }

  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">{getIcon()}</div>
          <CardTitle>{title || getDefaultTitle()}</CardTitle>
          <CardDescription>{message || getDefaultMessage()}</CardDescription>
        </CardHeader>
        {onRetry && (
          <CardContent>
            <Button onClick={onRetry} variant="outline" className="w-full bg-transparent">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
