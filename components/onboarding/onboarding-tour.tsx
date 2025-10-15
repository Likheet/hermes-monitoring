"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { X, ChevronRight, ChevronLeft } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface TourStep {
  title: string
  description: string
  target?: string
  image?: string
}

const workerTourSteps: TourStep[] = [
  {
    title: "Welcome to Task Manager",
    description: "Let's take a quick tour to help you get started with managing your daily tasks efficiently.",
  },
  {
    title: "Your Task Dashboard",
    description:
      "Here you'll see all your assigned tasks organized by status: Pending, In Progress, and Completed. Tap any task to view details.",
  },
  {
    title: "Task Priority Levels",
    description:
      "Tasks are color-coded by priority: Red for Guest Requests (urgent), Orange for Time-Sensitive, Blue for Daily Tasks, and Green for Preventive Maintenance.",
  },
  {
    title: "Starting a Task",
    description:
      "Tap a task to open it, then tap 'Start Task' to begin. The timer will track your progress automatically.",
  },
  {
    title: "Photo Requirements",
    description:
      "Some tasks require photo proof. When you see the camera icon, you'll need to take a photo before completing the task.",
  },
  {
    title: "Bottom Navigation",
    description:
      "Use the bottom navigation to quickly access your tasks, handover notes, and profile. Everything you need is just a tap away.",
  },
]

const supervisorTourSteps: TourStep[] = [
  {
    title: "Welcome, Supervisor",
    description: "Let's explore how you can monitor team performance and manage task assignments.",
  },
  {
    title: "Dashboard Overview",
    description:
      "Your dashboard shows key metrics: pending tasks, completion rates, and team performance. Use this to identify bottlenecks.",
  },
  {
    title: "Task Assignment",
    description:
      "Click 'Create Task' to assign new tasks to workers. Set priority levels and expected duration to help workers plan their day.",
  },
  {
    title: "Real-time Monitoring",
    description:
      "Track task progress in real-time. You'll see when workers start, pause, or complete tasks, along with their remarks.",
  },
  {
    title: "Quality Control",
    description:
      "Review completed tasks, check photos, and approve or reject work. Add supervisor remarks to provide feedback.",
  },
]

const adminTourSteps: TourStep[] = [
  {
    title: "Welcome, Admin",
    description: "You have full control over the system. Let's explore your administrative capabilities.",
  },
  {
    title: "User Management",
    description: "Create and manage user accounts for workers and supervisors. Assign departments and shift timings.",
  },
  {
    title: "System Analytics",
    description:
      "Access comprehensive reports on task completion rates, worker performance, and department efficiency.",
  },
  {
    title: "System Health",
    description:
      "Monitor database usage, storage limits, and API calls. Get alerts when approaching Supabase free tier limits.",
  },
]

export function OnboardingTour() {
  const { user } = useAuth()
  const [showTour, setShowTour] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<TourStep[]>([])

  useEffect(() => {
    // Check if user has seen the tour
    if (!user) return

    const hasSeenTour = localStorage.getItem(`onboarding-${user.role}`)
    if (!hasSeenTour) {
      // Set appropriate tour steps based on role
      let tourSteps: TourStep[] = []
      if (user.role === "worker") {
        tourSteps = workerTourSteps
      } else if (user.role === "supervisor") {
        tourSteps = supervisorTourSteps
      } else if (user.role === "admin") {
        tourSteps = adminTourSteps
      }

      // Only show tour if we have steps
      if (tourSteps.length > 0) {
        setSteps(tourSteps)
        setShowTour(true)
      }
    }
  }, [user])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    if (user) {
      localStorage.setItem(`onboarding-${user.role}`, "true")
    }
    setShowTour(false)
  }

  const handleSkip = () => {
    if (user) {
      localStorage.setItem(`onboarding-${user.role}`, "true")
    }
    setShowTour(false)
  }

  if (!showTour || steps.length === 0 || !user) return null

  const currentStepData = steps[currentStep]

  if (!currentStepData) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle>{currentStepData.title}</CardTitle>
              <CardDescription className="mt-2">{currentStepData.description}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Step {currentStep + 1} of {steps.length}
            </span>
            <div className="flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    index === currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrevious} className="flex-1 bg-transparent">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
            )}
            <Button onClick={handleNext} className="flex-1">
              {currentStep === steps.length - 1 ? (
                "Get Started"
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          <Button variant="ghost" onClick={handleSkip} className="w-full">
            Skip Tour
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
