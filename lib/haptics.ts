export function triggerHaptic(type: "light" | "medium" | "heavy" = "medium") {
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return
  }

  const patterns = {
    light: 10,
    medium: 20,
    heavy: 30,
  }

  try {
    navigator.vibrate(patterns[type])
  } catch (error) {
    // Silently fail if vibration not supported
  }
}

export function triggerSuccessHaptic() {
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return
  }

  try {
    // Double tap pattern for success
    navigator.vibrate([10, 50, 10])
  } catch (error) {
  }
}

export function triggerErrorHaptic() {
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return
  }

  try {
    // Triple tap pattern for error
    navigator.vibrate([20, 50, 20, 50, 20])
  } catch (error) {
  }
}

export function triggerHapticFeedback(type: "success" | "error" | "light" | "medium" | "heavy" = "medium") {
  if (type === "success") {
    triggerSuccessHaptic()
  } else if (type === "error") {
    triggerErrorHaptic()
  } else {
    triggerHaptic(type)
  }
}
