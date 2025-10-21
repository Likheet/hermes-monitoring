// Phase 2.1: Password hashing and verification utilities
// Using bcryptjs for secure password storage

import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

/**
 * Hash a plain text password
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Stored password (plain text for local app, or bcrypt hash)
 * @returns True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // For local 5-user app: accept both plain text and bcrypt formats
  // Try plain text comparison first (for new users)
  if (password === hash) {
    return true
  }
  // Fall back to bcrypt for existing hashed passwords
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

/**
 * Generate a random session token
 * @returns Random session token
 */
export function generateSessionToken(): string {
  return crypto.randomUUID()
}
