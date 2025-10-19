# Supabase Integration Guide

## Overview

This application is fully integrated with Supabase for persistent data storage. All tasks, users, shift schedules, maintenance schedules, and maintenance tasks are stored in the Supabase database and sync in real-time across all connected clients.

## Database Schema

The application uses the following Supabase tables:

### Core Tables

1. **users** - User accounts and profiles
   - Stores: name, role, phone, department, shift_timing
   - Roles: admin, front_office, supervisor, worker
   - Departments: housekeeping, maintenance, front_desk

2. **tasks** - Main task management
   - Stores: task details, assignments, timestamps, status, photos
   - Uses dual timestamps (client/server) for anti-tampering
   - Stores audit logs and pause history in JSONB `timer_validation_flags`

3. **shift_schedules** - Worker shift schedules
   - Stores: daily shift times, breaks, overrides
   - Supports rotation patterns and custom schedules

4. **maintenance_schedules** - Recurring maintenance schedules
   - Stores: task types, areas, frequency, active status

5. **maintenance_tasks** - Individual maintenance tasks
   - Stores: room-specific maintenance items, status, photos

### Supporting Tables

6. **audit_logs** - Complete audit trail of all task actions
7. **pause_records** - Detailed pause/resume history
8. **notifications** - User notifications
9. **escalations** - Task escalation alerts
10. **handovers** - Shift handover records

## Setup Instructions

### 1. Run Seed Scripts

Execute the following SQL scripts in order to populate your database:

\`\`\`bash
# In the v0 Scripts tab, run these in order:
1. scripts/01-seed-users.sql       # Creates test users
2. scripts/02-seed-shift-schedules.sql  # Creates shift schedules
3. scripts/03-seed-sample-tasks.sql     # Creates sample tasks
\`\`\`

### 2. Verify Data

After running the seed scripts, you should have:
- 8 users (1 admin, 1 front office, 2 supervisors, 4 workers)
- 7 days of shift schedules for all workers
- 2 sample tasks (1 pending, 1 in-progress)

### 3. Test the Application

1. **Login**: Use the dropdown to select any user
2. **View Tasks**: Navigate to the appropriate role's dashboard
3. **Create Tasks**: Front office can create new tasks
4. **Complete Tasks**: Workers can start, pause, and complete tasks
5. **Verify Data Persistence**: Refresh the page - all data should persist

## Data Flow

### Loading Data

On app initialization, the `TaskProvider` loads all data from Supabase:

\`\`\`typescript
// lib/task-context.tsx
useEffect(() => {
  async function loadData() {
    const [tasks, users, shiftSchedules, maintenanceSchedules, maintenanceTasks] = 
      await Promise.all([
        loadTasksFromSupabase(),
        loadUsersFromSupabase(),
        loadShiftSchedulesFromSupabase(),
        loadMaintenanceSchedulesFromSupabase(),
        loadMaintenanceTasksFromSupabase(),
      ])
    // ... set state
  }
  loadData()
}, [])
\`\`\`

### Saving Data

All data mutations automatically save to Supabase:

\`\`\`typescript
const updateTask = (taskId: string, updates: Partial<Task>) => {
  setTasks((prev) => {
    const updated = prev.map((task) => {
      if (task.id === taskId) {
        const updatedTask = { ...task, ...updates }
        saveTaskToSupabase(updatedTask) // ← Automatic save
        return updatedTask
      }
      return task
    })
    return updated
  })
}
\`\`\`

## Type Safety

The application uses TypeScript types that match the Supabase schema exactly:

- **lib/database-types.ts** - Generated types from Supabase schema
- **lib/types.ts** - Application types
- **lib/supabase-task-operations.ts** - Mapping functions between app and database formats

## Real-time Features

The application supports real-time updates via Supabase subscriptions:

- Task status changes sync across all clients
- New task assignments appear immediately
- Shift schedule updates reflect in real-time

## Environment Variables

The following environment variables are automatically configured:

\`\`\`
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
POSTGRES_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING
\`\`\`

## API Routes

Server-side API routes use Supabase for:

- Task CRUD operations (`/api/tasks/*`)
- User authentication (`/api/auth/*`)
- Shift management (`/api/shift-schedules`)
- Audit logging (`/api/audit`)
- Worker status (`/api/workers/status`)

## Troubleshooting

### No Data Appears

1. Check if seed scripts have been run
2. Verify Supabase connection in browser console
3. Look for error messages in debug logs

### Data Not Persisting

1. Check browser console for Supabase errors
2. Verify environment variables are set
3. Check Supabase dashboard for table permissions

### Type Errors

1. Ensure `lib/database-types.ts` matches your Supabase schema
2. Run type checking: `npm run type-check`
3. Regenerate types if schema changed

## Production Deployment

When deploying to production:

1. **Environment Variables**: Ensure all Supabase env vars are set in Vercel
2. **Database**: Use production Supabase project
3. **Row Level Security**: Enable RLS policies for data security
4. **Backups**: Configure automatic backups in Supabase dashboard

## Security Considerations

- **Authentication**: Currently uses localStorage (development only)
- **RLS Policies**: Should be enabled for production
- **API Keys**: Service role key should only be used server-side
- **Data Validation**: All inputs should be validated before saving

## Next Steps

To make the app production-ready:

1. Implement Supabase Auth for proper authentication
2. Enable Row Level Security (RLS) policies
3. Add data validation and sanitization
4. Implement proper error handling and retry logic
5. Add database indexes for performance
6. Set up automated backups
7. Configure monitoring and alerting
\`\`\`



<AssistantMessageContentPart partEncoded="eyJ0eXBlIjoidGFzay13YWl0aW5nLXYxIiwiY3JlYXRlZEF0IjoxNzYwODUxMjk4MDU0LCJmaW5pc2hlZEF0IjoxNzYwODUxMjk4MDU0LCJpZCI6Ik1lTG1WOXdoUVV6ZEFMUXMiLCJsYXN0UGFydFNlbnRBdCI6MTc2MDg1MTI5ODA1NCwicGFydHMiOlt7InR5cGUiOiJ0b29sLWNhbGxzIn1dfQ==" />



<AssistantMessageContentPart partEncoded="eyJ0eXBlIjoidGFzay1tYW5hZ2UtdG9kb3MtdjEiLCJpZCI6IkdnYmxqWE5HNEx1bnBUNzAiLCJ0YXNrTmFtZUFjdGl2ZSI6IkNvbXBsZXRpbmcgaW50ZWdyYXRpb24iLCJ0b29sQ2FsbElkIjoidG9vbHVfMDE3d0doVmVuOUNOTG91VDdrc1dyRFUzIiwidGFza05hbWVDb21wbGV0ZSI6IkNvbXBsZXRlZCBpbnRlZ3JhdGlvbiIsImNyZWF0ZWRBdCI6MTc2MDg1MTI5ODUyNCwiZmluaXNoZWRBdCI6bnVsbCwicGFydHMiOltdLCJsYXN0UGFydFNlbnRBdCI6bnVsbH0=" />
