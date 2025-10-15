"use client"

import type React from "react"

import { useState, useMemo, useEffect, useRef } from "react"
import { Search, Clock, Camera } from "lucide-react"
import {
  TASK_DEFINITIONS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type TaskDefinition,
  type TaskCategory,
} from "@/lib/task-definitions"

interface TaskSearchProps {
  onSelectTask: (task: TaskDefinition) => void
}

export function TaskSearch({ onSelectTask }: TaskSearchProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Filter tasks based on search query and category
  const filteredTasks = useMemo(() => {
    let tasks = TASK_DEFINITIONS

    // Filter by category if selected
    if (selectedCategory) {
      tasks = tasks.filter((task) => task.category === selectedCategory)
    }

    // Filter by search query (minimum 2 characters)
    if (searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase()
      tasks = tasks.filter((task) => {
        // Check task name
        if (task.name.toLowerCase().includes(query)) return true
        // Check keywords
        return task.keywords.some((keyword) => keyword.toLowerCase().includes(query))
      })

      // Sort by relevance (exact match first, then partial match)
      tasks.sort((a, b) => {
        const aExact = a.name.toLowerCase().includes(query)
        const bExact = b.name.toLowerCase().includes(query)
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        return 0
      })
    }

    // Limit to top 8 results
    return tasks.slice(0, 8)
  }, [searchQuery, selectedCategory])

  // Handle category button click
  const handleCategoryClick = (category: TaskCategory) => {
    if (selectedCategory === category) {
      setSelectedCategory(null) // Toggle off if same category clicked
    } else {
      setSelectedCategory(category)
      setShowSuggestions(true) // Show suggestions when category selected
    }
  }

  // Handle task selection
  const handleSelectTask = (task: TaskDefinition) => {
    onSelectTask(task)
    setSearchQuery("")
    setShowSuggestions(false)
    setSelectedCategory(null)
  }

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowSuggestions(value.length >= 2 || selectedCategory !== null)
  }

  return (
    <div className="space-y-4" ref={searchRef}>
      {/* Quick Category Filters */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const category = key as TaskCategory
          const isActive = selectedCategory === category
          return (
            <button
              key={key}
              onClick={() => handleCategoryClick(category)}
              className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                isActive
                  ? CATEGORY_COLORS[category] + " border-current"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => setShowSuggestions(searchQuery.length >= 2 || selectedCategory !== null)}
            placeholder="Search for task... (water, AC, towel, cleaning, etc.)"
            className="w-full pl-12 pr-4 py-4 text-lg border-2 border-border rounded-xl focus:border-ring focus:outline-none bg-background text-foreground"
          />
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredTasks.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-card border-2 border-border rounded-xl shadow-lg max-h-96 overflow-y-auto">
            {filteredTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => handleSelectTask(task)}
                className="w-full text-left px-4 py-3 hover:bg-muted border-b border-border last:border-b-0 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground mb-1">{task.name}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md border text-xs font-medium ${CATEGORY_COLORS[task.category]}`}
                      >
                        {CATEGORY_LABELS[task.category]}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {task.duration} min
                      </span>
                      {task.photoRequired && (
                        <span className="flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5" />
                          {task.photoCount} photo{task.photoCount > 1 ? "s" : ""}
                        </span>
                      )}
                      {task.deadline && <span className="text-destructive font-medium">Deadline: {task.deadline}</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No Results Message */}
        {showSuggestions && searchQuery.length >= 2 && filteredTasks.length === 0 && (
          <div className="absolute z-50 w-full mt-2 bg-card border-2 border-border rounded-xl shadow-lg p-4 text-center text-muted-foreground">
            No tasks found for "{searchQuery}". Try different keywords or use the category filters above.
          </div>
        )}
      </div>
    </div>
  )
}
