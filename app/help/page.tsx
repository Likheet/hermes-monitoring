"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, BookOpen, Video, MessageCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

const workerFAQs = [
  {
    question: "How do I start a task?",
    answer:
      "Tap on any pending task from your dashboard to open the task details. Then tap the 'Start Task' button. The timer will automatically begin tracking your progress.",
  },
  {
    question: "What if I need to pause a task?",
    answer:
      "If you need to pause a task (e.g., waiting for supplies), tap the 'Pause Task' button and provide a reason. You can resume it later from your dashboard.",
  },
  {
    question: "How do I take a photo for a task?",
    answer:
      "When a task requires a photo, you'll see a 'Capture Photo' button. Tap it to open your camera, take the photo, and confirm. The photo will be automatically uploaded.",
  },
  {
    question: "What are the different priority levels?",
    answer:
      "Red = Guest Request (urgent, handle immediately), Orange = Time-Sensitive (complete within shift), Blue = Daily Task (routine work), Green = Preventive Maintenance (scheduled maintenance).",
  },
  {
    question: "How do I add handover notes?",
    answer:
      "Go to the Handover tab in the bottom navigation. Add notes about incomplete tasks, issues, or important information for the next shift.",
  },
  {
    question: "What if I can't complete a task on time?",
    answer:
      "If you're running late, add a worker remark explaining the delay. Your supervisor will be notified and can reassign if needed.",
  },
]

const supervisorFAQs = [
  {
    question: "How do I create a new task?",
    answer:
      "Click the 'Create Task' button on your dashboard. Fill in the task details including type, priority, room number, and assign it to a worker. Set the expected duration to help workers plan.",
  },
  {
    question: "How do I monitor task progress?",
    answer:
      "Your dashboard shows all tasks in real-time. You can see which tasks are pending, in progress, or completed. Click any task to view detailed progress and worker remarks.",
  },
  {
    question: "What should I do if a task is rejected?",
    answer:
      "When rejecting a task, always provide a clear supervisor remark explaining what needs to be fixed. The task will be reassigned to the worker for correction.",
  },
  {
    question: "How do I handle escalations?",
    answer:
      "If a task is delayed or has issues, you'll see an escalation alert. Review the worker's remarks, assess the situation, and either provide guidance or reassign the task.",
  },
]

const adminFAQs = [
  {
    question: "How do I add new users?",
    answer:
      "Go to User Management and click 'Add User'. Enter their details including name, role, department, and shift timing. They'll receive login credentials.",
  },
  {
    question: "How do I monitor system health?",
    answer:
      "Visit the System Health page to see database usage, storage limits, and API calls. You'll get alerts when approaching Supabase free tier limits.",
  },
  {
    question: "What happens when we reach storage limits?",
    answer:
      "The system will automatically archive tasks older than 6 months and delete old notifications. You can also manually trigger cleanup from the System Health page.",
  },
  {
    question: "How do I generate reports?",
    answer:
      "Go to Analytics to view comprehensive reports on task completion rates, worker performance, and department efficiency. Export data as needed.",
  },
]

export default function HelpPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")

  const getFAQs = () => {
    if (user?.role === "worker") return workerFAQs
    if (user?.role === "supervisor") return supervisorFAQs
    if (user?.role === "admin") return adminFAQs
    return []
  }

  const faqs = getFAQs()
  const filteredFAQs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Help & Support</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>How can we help you?</CardTitle>
            <CardDescription>Search for answers or browse frequently asked questions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="pt-6 text-center">
              <BookOpen className="h-8 w-8 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold mb-1">User Guide</h3>
              <p className="text-sm text-muted-foreground">Step-by-step instructions</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="pt-6 text-center">
              <Video className="h-8 w-8 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold mb-1">Video Tutorials</h3>
              <p className="text-sm text-muted-foreground">Watch how-to videos</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="pt-6 text-center">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
              <h3 className="font-semibold mb-1">Contact Support</h3>
              <p className="text-sm text-muted-foreground">Get help from our team</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>
              {filteredFAQs.length} {filteredFAQs.length === 1 ? "question" : "questions"} for {user?.role}s
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredFAQs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No results found. Try a different search term.</p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {filteredFAQs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Still need help?</CardTitle>
            <CardDescription>Our support team is here to assist you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">Email Support</p>
                <p className="text-sm text-muted-foreground">support@resort-tasks.com</p>
              </div>
              <Button variant="outline" className="bg-transparent">
                Send Email
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">Phone Support</p>
                <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
              </div>
              <Button variant="outline" className="bg-transparent">
                Call Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
