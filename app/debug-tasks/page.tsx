
"use client"

import { useEffect, useState } from "react"
import { loadMaintenanceTasksFromSupabase } from "@/lib/supabase-task-operations"

export default function DebugTasksPage() {
    const [tasks, setTasks] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const data = await loadMaintenanceTasksFromSupabase({ forceRefresh: true })
                setTasks(data)
            } catch (e: any) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    if (loading) return <div>Loading...</div>
    if (error) return <div>Error: {error}</div>

    return (
        <div className="p-4">
            <h1>Debug Maintenance Tasks (via Helper)</h1>
            <p>Count: {tasks.length}</p>
            <pre>{JSON.stringify(tasks, null, 2)}</pre>
        </div>
    )
}
