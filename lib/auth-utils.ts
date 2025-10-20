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
 * @param hash - Stored password hash
 * @returns True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a random session token
 * @returns Random session token
 */
export function generateSessionToken(): string {
  return crypto.randomUUID()
}
