import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const testUsers = [
  {
    email: "worker1@resort.com",
    password: "password123",
    user_metadata: {
      name: "John Worker",
      role: "worker",
      phone: "+1234567890",
      department: "housekeeping",
      shift_timing: "9 AM - 5 PM",
    },
  },
  {
    email: "worker2@resort.com",
    password: "password123",
    user_metadata: {
      name: "Sarah Maintenance",
      role: "worker",
      phone: "+1234567891",
      department: "maintenance",
      shift_timing: "10 AM - 6 PM",
    },
  },
  {
    email: "supervisor@resort.com",
    password: "password123",
    user_metadata: {
      name: "Mike Supervisor",
      role: "supervisor",
      phone: "+1234567892",
      department: "housekeeping",
      shift_timing: "8 AM - 4 PM",
    },
  },
  {
    email: "frontoffice@resort.com",
    password: "password123",
    user_metadata: {
      name: "Lisa Front Office",
      role: "front_office",
      phone: "+1234567893",
      department: "housekeeping",
      shift_timing: "24/7",
    },
  },
  {
    email: "admin@resort.com",
    password: "password123",
    user_metadata: {
      name: "Admin User",
      role: "admin",
      phone: "+1234567894",
      department: "housekeeping",
      shift_timing: "24/7",
    },
  },
]

async function createTestUsers() {
  console.log("Creating test users...")

  for (const user of testUsers) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: user.user_metadata,
    })

    if (error) {
      console.error(`Error creating ${user.email}:`, error.message)
    } else {
      console.log(`✓ Created user: ${user.email}`)
    }
  }

  console.log("\nTest users created successfully!")
  console.log("\nYou can now login with:")
  console.log("- worker1@resort.com / password123")
  console.log("- worker2@resort.com / password123")
  console.log("- supervisor@resort.com / password123")
  console.log("- frontoffice@resort.com / password123")
  console.log("- admin@resort.com / password123")
}

createTestUsers()
