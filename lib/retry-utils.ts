export interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  onRetry?: (attempt: number, error: Error) => void
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 10000, backoffMultiplier = 2, onRetry } = options

  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        throw lastError
      }

      const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay)

      if (onRetry) {
        onRetry(attempt, lastError)
      }


      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

export function isNetworkError(error: unknown): error is TypeError {
  if (!(error instanceof TypeError)) {
    return false
  }

  const message = error.message ?? ""

  return message.includes("fetch") || message.includes("network") || message.includes("Failed to fetch")
}

function hasStatusCode(value: unknown): value is { status: number } {
  return typeof value === "object" && value !== null && "status" in value && typeof (value as { status: unknown }).status === "number"
}

export function shouldRetry(error: unknown): boolean {
  // Retry on network errors
  if (isNetworkError(error)) {
    return true
  }

  // Retry on 5xx server errors
  if (hasStatusCode(error) && error.status >= 500 && error.status < 600) {
    return true
  }

  // Retry on 429 (rate limit)
  if (hasStatusCode(error) && error.status === 429) {
    return true
  }

  return false
}
