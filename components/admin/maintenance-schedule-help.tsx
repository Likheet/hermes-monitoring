"use client"

import { useState } from "react"
import { Info, ChevronDown, ChevronUp, Calendar, Clock, MapPin, CheckCircle2, AlertCircle } from "lucide-react"

export function MaintenanceScheduleHelp() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-blue-900">New to Maintenance Schedules?</h3>
            <p className="text-sm text-blue-700">Click to learn how to manage maintenance schedules effectively</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-blue-700 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-blue-700 flex-shrink-0" />
        )}
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-6 pt-2 space-y-6 border-t-2 border-blue-200">
          {/* Overview */}
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">What are Maintenance Schedules?</h4>
            <p className="text-sm text-blue-800 leading-relaxed">
              Maintenance schedules automate the creation of recurring maintenance tasks for your resort. Instead of
              manually creating tasks each month, you define a schedule once, and the system automatically generates
              tasks for all rooms based on your configuration.
            </p>
          </div>

          {/* Key Concepts */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-blue-900 mb-1">Task Types</h5>
                  <p className="text-sm text-blue-800">
                    Choose from AC Indoor, AC Outdoor, Fan, or Exhaust maintenance. Each type represents a specific
                    maintenance activity that needs to be performed regularly.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-blue-900 mb-1">Areas</h5>
                  <p className="text-sm text-blue-800">
                    Select which building blocks to include: Block A (rooms 501-530), Block B (rooms 1101-1142), or
                    both. This determines which rooms receive the scheduled tasks.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-blue-900 mb-1">Frequency</h5>
                  <p className="text-sm text-blue-800">
                    Set how often tasks repeat: Monthly (every month), Quarterly (every 3 months), or Custom (specify
                    number of weeks). This controls the recurrence pattern.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-blue-900 mb-1">Schedule Days</h5>
                  <p className="text-sm text-blue-800">
                    Define the day range (1-31) when tasks should be created each cycle. For example, days 1-15 creates
                    tasks in the first half of the month.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* How to Create */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full text-sm">
                1
              </span>
              Creating a Schedule
            </h4>
            <ol className="space-y-2 text-sm text-blue-800 ml-8">
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[20px]">1.</span>
                <span>Click the "Create Schedule" button to open the schedule form</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[20px]">2.</span>
                <span>Select the task type (e.g., AC Indoor Unit maintenance)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[20px]">3.</span>
                <span>Choose which area(s) to include (Block A, Block B, or both)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[20px]">4.</span>
                <span>Set the frequency (how often tasks should repeat)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[20px]">5.</span>
                <span>Define the day range when tasks should be created (e.g., days 1-15)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[20px]">6.</span>
                <span>Save the schedule - tasks will be automatically generated based on your configuration</span>
              </li>
            </ol>
          </div>

          {/* Best Practices */}
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Best Practices
            </h4>
            <ul className="space-y-2 text-sm text-amber-900">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>
                  <strong>Stagger schedules:</strong> Avoid scheduling all maintenance types on the same days to
                  distribute workload evenly
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>
                  <strong>Start with monthly:</strong> Begin with monthly schedules for critical maintenance (AC, Fan)
                  and quarterly for less frequent tasks
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>
                  <strong>Monitor progress:</strong> Check the progress column regularly to ensure tasks are being
                  completed on time
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>
                  <strong>Use Quick Setup:</strong> For standard configurations, use the "Generate Monthly Template"
                  button to create all common schedules at once
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>
                  <strong>Toggle inactive schedules:</strong> Temporarily disable schedules during off-seasons or
                  renovations instead of deleting them
                </span>
              </li>
            </ul>
          </div>

          {/* Managing Schedules */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full text-sm">
                2
              </span>
              Managing Existing Schedules
            </h4>
            <div className="space-y-3 text-sm text-blue-800 ml-8">
              <div>
                <strong className="text-blue-900">Edit:</strong> Click the edit icon to modify schedule parameters.
                Changes apply to future task generation, not existing tasks.
              </div>
              <div>
                <strong className="text-blue-900">Toggle Active/Inactive:</strong> Click the toggle to pause or resume
                task generation without deleting the schedule configuration.
              </div>
              <div>
                <strong className="text-blue-900">Delete:</strong> Permanently removes the schedule and all associated
                tasks. Use with caution - this cannot be undone.
              </div>
              <div>
                <strong className="text-blue-900">Progress Tracking:</strong> The progress bar shows completed vs total
                tasks for the current cycle, helping you monitor maintenance completion rates.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
