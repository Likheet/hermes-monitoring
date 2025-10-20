import bcrypt from "bcryptjs"

async function generateHashes() {
  const passwords = {
    admin123: await bcrypt.hash("admin123", 10),
    front123: await bcrypt.hash("front123", 10),
    super123: await bcrypt.hash("super123", 10),
    worker123: await bcrypt.hash("worker123", 10),
  }

  console.log("Generated password hashes:")
  console.log("admin123:", passwords.admin123)
  console.log("front123:", passwords.front123)
  console.log("super123:", passwords.super123)
  console.log("worker123:", passwords.worker123)
}

generateHashes()
