import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addSampleData() {
  console.log("Adding comprehensive sample data...")

  // Get existing users
  const { data: users } = await supabase.from("users").select("*")

  if (!users || users.length === 0) {
    console.error("No users found. Please create users first.")
    return
  }

  const frontOfficeUser = users.find((u) => u.role === "front_office")
  const supervisorUser = users.find((u) => u.role === "supervisor")
  const hkWorker = users.find((u) => u.role === "worker" && u.department === "housekeeping")
  const maintenanceWorker = users.find((u) => u.role === "worker" && u.department === "maintenance")

  if (!frontOfficeUser || !supervisorUser || !hkWorker || !maintenanceWorker) {
    console.error("Missing required users. Need front_office, supervisor, and workers.")
    return
  }

  // Sample tasks with various statuses and remarks
  const sampleTasks = [
    // Pending task with front-office remark
    {
      task_type: "Room Cleaning",
      room_number: "101",
      priority_level: "DAILY_TASK",
      status: "PENDING",
      assigned_to_user_id: hkWorker.id,
      assigned_by_user_id: frontOfficeUser.id,
      expected_duration_minutes: 30,
      photo_required: true,
      worker_remark: "Guest requested extra attention to bathroom. Please use lavender-scented cleaning products.",
      category: "HOUSEKEEPING",
      assigned_at: { client: new Date().toISOString(), server: new Date().toISOString() },
    },
    // In-progress task with detailed instructions
    {
      task_type: "VIP Suite Preparation",
      room_number: "501",
      priority_level: "TIME_SENSITIVE",
      status: "IN_PROGRESS",
      assigned_to_user_id: hkWorker.id,
      assigned_by_user_id: frontOfficeUser.id,
      expected_duration_minutes: 45,
      photo_required: true,
      worker_remark:
        "VIP guest arriving at 2 PM. Please ensure fresh flowers are placed, minibar is fully stocked, and welcome amenities are set up. Extra pillows requested.",
      category: "HOUSEKEEPING",
      assigned_at: {
        client: new Date(Date.now() - 30 * 60000).toISOString(),
        server: new Date(Date.now() - 30 * 60000).toISOString(),
      },
      started_at: {
        client: new Date(Date.now() - 25 * 60000).toISOString(),
        server: new Date(Date.now() - 25 * 60000).toISOString(),
      },
      pause_history: [],
    },
    // Rejected task with supervisor remark
    {
      task_type: "Bathroom Deep Clean",
      room_number: "203",
      priority_level: "GUEST_REQUEST",
      status: "REJECTED",
      assigned_to_user_id: hkWorker.id,
      assigned_by_user_id: frontOfficeUser.id,
      expected_duration_minutes: 40,
      photo_required: true,
      worker_remark: "Guest complained about soap scum on shower door. Please use specialized cleaner.",
      supervisor_remark:
        "Photos show shower door still has visible streaks. Please re-clean using the glass cleaner and ensure all surfaces are completely dry and streak-free.",
      category: "HOUSEKEEPING",
      assigned_at: {
        client: new Date(Date.now() - 120 * 60000).toISOString(),
        server: new Date(Date.now() - 120 * 60000).toISOString(),
      },
      started_at: {
        client: new Date(Date.now() - 110 * 60000).toISOString(),
        server: new Date(Date.now() - 110 * 60000).toISOString(),
      },
      completed_at: {
        client: new Date(Date.now() - 80 * 60000).toISOString(),
        server: new Date(Date.now() - 80 * 60000).toISOString(),
      },
      verified_at: {
        client: new Date(Date.now() - 70 * 60000).toISOString(),
        server: new Date(Date.now() - 70 * 60000).toISOString(),
      },
      verified_by_user_id: supervisorUser.id,
      actual_duration_minutes: 35,
      pause_history: [],
    },
    // Another rejected task
    {
      task_type: "Carpet Stain Removal",
      room_number: "305",
      priority_level: "GUEST_REQUEST",
      status: "REJECTED",
      assigned_to_user_id: hkWorker.id,
      assigned_by_user_id: frontOfficeUser.id,
      expected_duration_minutes: 25,
      photo_required: true,
      worker_remark: "Red wine stain near the bed. Guest checking out tomorrow morning.",
      supervisor_remark:
        "Stain is still visible in the photos. Please use the carpet spot cleaner machine and treat the area twice. Let it dry completely before taking photos.",
      category: "HOUSEKEEPING",
      assigned_at: {
        client: new Date(Date.now() - 180 * 60000).toISOString(),
        server: new Date(Date.now() - 180 * 60000).toISOString(),
      },
      started_at: {
        client: new Date(Date.now() - 170 * 60000).toISOString(),
        server: new Date(Date.now() - 170 * 60000).toISOString(),
      },
      completed_at: {
        client: new Date(Date.now() - 150 * 60000).toISOString(),
        server: new Date(Date.now() - 150 * 60000).toISOString(),
      },
      verified_at: {
        client: new Date(Date.now() - 140 * 60000).toISOString(),
        server: new Date(Date.now() - 140 * 60000).toISOString(),
      },
      verified_by_user_id: supervisorUser.id,
      actual_duration_minutes: 20,
      pause_history: [],
    },
    // Completed task
    {
      task_type: "Turndown Service",
      room_number: "402",
      priority_level: "DAILY_TASK",
      status: "COMPLETED",
      assigned_to_user_id: hkWorker.id,
      assigned_by_user_id: frontOfficeUser.id,
      expected_duration_minutes: 15,
      photo_required: true,
      worker_remark: "Standard turndown service. Guest requested extra chocolates.",
      category: "HOUSEKEEPING",
      assigned_at: {
        client: new Date(Date.now() - 240 * 60000).toISOString(),
        server: new Date(Date.now() - 240 * 60000).toISOString(),
      },
      started_at: {
        client: new Date(Date.now() - 230 * 60000).toISOString(),
        server: new Date(Date.now() - 230 * 60000).toISOString(),
      },
      completed_at: {
        client: new Date(Date.now() - 220 * 60000).toISOString(),
        server: new Date(Date.now() - 220 * 60000).toISOString(),
      },
      actual_duration_minutes: 12,
      pause_history: [],
    },
    // Maintenance task - pending
    {
      task_type: "AC Unit Inspection",
      room_number: "201",
      priority_level: "GUEST_REQUEST",
      status: "PENDING",
      assigned_to_user_id: maintenanceWorker.id,
      assigned_by_user_id: frontOfficeUser.id,
      expected_duration_minutes: 30,
      photo_required: true,
      worker_remark: "Guest reports AC making loud noise. Please check and fix if possible.",
      category: "MAINTENANCE",
      assigned_at: { client: new Date().toISOString(), server: new Date().toISOString() },
    },
    // Maintenance task - in progress
    {
      task_type: "Leaky Faucet Repair",
      room_number: "304",
      priority_level: "TIME_SENSITIVE",
      status: "IN_PROGRESS",
      assigned_to_user_id: maintenanceWorker.id,
      assigned_by_user_id: frontOfficeUser.id,
      expected_duration_minutes: 45,
      photo_required: true,
      worker_remark: "Bathroom sink faucet dripping constantly. Guest complained about noise at night.",
      category: "MAINTENANCE",
      assigned_at: {
        client: new Date(Date.now() - 40 * 60000).toISOString(),
        server: new Date(Date.now() - 40 * 60000).toISOString(),
      },
      started_at: {
        client: new Date(Date.now() - 35 * 60000).toISOString(),
        server: new Date(Date.now() - 35 * 60000).toISOString(),
      },
      pause_history: [],
    },
    // Maintenance task - rejected
    {
      task_type: "Light Bulb Replacement",
      room_number: "405",
      priority_level: "DAILY_TASK",
      status: "REJECTED",
      assigned_to_user_id: maintenanceWorker.id,
      assigned_by_user_id: frontOfficeUser.id,
      expected_duration_minutes: 15,
      photo_required: true,
      worker_remark: "Replace all burnt-out bulbs in the room. Guest mentioned bedside lamp not working.",
      supervisor_remark:
        "Photo shows the bedside lamp is still not working. Please check if it's a wiring issue, not just the bulb. Test all lamps before completing.",
      category: "MAINTENANCE",
      assigned_at: {
        client: new Date(Date.now() - 200 * 60000).toISOString(),
        server: new Date(Date.now() - 200 * 60000).toISOString(),
      },
      started_at: {
        client: new Date(Date.now() - 190 * 60000).toISOString(),
        server: new Date(Date.now() - 190 * 60000).toISOString(),
      },
      completed_at: {
        client: new Date(Date.now() - 180 * 60000).toISOString(),
        server: new Date(Date.now() - 180 * 60000).toISOString(),
      },
      verified_at: {
        client: new Date(Date.now() - 170 * 60000).toISOString(),
        server: new Date(Date.now() - 170 * 60000).toISOString(),
      },
      verified_by_user_id: supervisorUser.id,
      actual_duration_minutes: 10,
      pause_history: [],
    },
    // Task with pause history
    {
      task_type: "Balcony Cleaning",
      room_number: "601",
      priority_level: "DAILY_TASK",
      status: "COMPLETED",
      assigned_to_user_id: hkWorker.id,
      assigned_by_user_id: frontOfficeUser.id,
      expected_duration_minutes: 20,
      photo_required: true,
      worker_remark: "Clean balcony furniture and sweep floor. Check for any maintenance issues.",
      category: "HOUSEKEEPING",
      assigned_at: {
        client: new Date(Date.now() - 300 * 60000).toISOString(),
        server: new Date(Date.now() - 300 * 60000).toISOString(),
      },
      started_at: {
        client: new Date(Date.now() - 290 * 60000).toISOString(),
        server: new Date(Date.now() - 290 * 60000).toISOString(),
      },
      completed_at: {
        client: new Date(Date.now() - 260 * 60000).toISOString(),
        server: new Date(Date.now() - 260 * 60000).toISOString(),
      },
      actual_duration_minutes: 25,
      pause_history: [
        {
          paused_at: {
            client: new Date(Date.now() - 280 * 60000).toISOString(),
            server: new Date(Date.now() - 280 * 60000).toISOString(),
          },
          resumed_at: {
            client: new Date(Date.now() - 270 * 60000).toISOString(),
            server: new Date(Date.now() - 270 * 60000).toISOString(),
          },
          reason: "Emergency task assigned",
        },
      ],
    },
    // Guest request with urgent remark
    {
      task_type: "Extra Towels Delivery",
      room_number: "502",
      priority_level: "GUEST_REQUEST",
      status: "PENDING",
      assigned_to_user_id: hkWorker.id,
      assigned_by_user_id: frontOfficeUser.id,
      expected_duration_minutes: 10,
      photo_required: false,
      worker_remark: "URGENT: Guest needs 4 extra bath towels immediately. Family with children just checked in.",
      category: "HOUSEKEEPING",
      assigned_at: { client: new Date().toISOString(), server: new Date().toISOString() },
    },
  ]

  // Insert tasks
  for (const task of sampleTasks) {
    const { error } = await supabase.from("tasks").insert(task)
    if (error) {
      console.error("Error inserting task:", error)
    } else {
      console.log(`✓ Added task: ${task.task_type} - Room ${task.room_number} (${task.status})`)
    }
  }

  console.log("\n✅ Sample data added successfully!")
  console.log("\nSummary:")
  console.log(`- ${sampleTasks.filter((t) => t.status === "PENDING").length} pending tasks`)
  console.log(`- ${sampleTasks.filter((t) => t.status === "IN_PROGRESS").length} in-progress tasks`)
  console.log(`- ${sampleTasks.filter((t) => t.status === "COMPLETED").length} completed tasks`)
  console.log(`- ${sampleTasks.filter((t) => t.status === "REJECTED").length} rejected tasks`)
  console.log(`- ${sampleTasks.filter((t) => t.worker_remark).length} tasks with front-office remarks`)
  console.log(`- ${sampleTasks.filter((t) => t.supervisor_remark).length} tasks with supervisor rejection remarks`)
}

addSampleData()
