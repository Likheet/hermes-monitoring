import { z } from "zod"

export const taskSchema = z.object({
  task_type: z.string().min(1, "Task type is required"),
  priority_level: z.enum(["GUEST_REQUEST", "TIME_SENSITIVE", "DAILY_TASK", "PREVENTIVE_MAINTENANCE"]),
  assigned_to_user_id: z.string().uuid("Invalid user ID"),
  expected_duration_minutes: z
    .number()
    .min(1, "Duration must be at least 1 minute")
    .max(480, "Duration cannot exceed 8 hours"),
  room_number: z.string().min(1, "Room number is required"),
  photo_required: z.boolean(),
})

export const workerRemarkSchema = z.object({
  worker_remark: z
    .string()
    .min(10, "Remark must be at least 10 characters")
    .max(500, "Remark cannot exceed 500 characters"),
})

export const supervisorRemarkSchema = z.object({
  supervisor_remark: z
    .string()
    .min(10, "Remark must be at least 10 characters")
    .max(500, "Remark cannot exceed 500 characters"),
})

export const delayReasonSchema = z.object({
  delay_reason: z
    .string()
    .min(20, "Please provide a detailed reason (at least 20 characters)")
    .max(500, "Reason cannot exceed 500 characters"),
})

export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {}
      error.errors.forEach((err) => {
        if (err.path) {
          errors[err.path.join(".")] = err.message
        }
      })
      return { success: false, errors }
    }
    return { success: false, errors: { _form: "Validation failed" } }
  }
}
