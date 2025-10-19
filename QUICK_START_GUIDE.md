# 🚀 Quick Start Guide — Hermes Task Management

**Status**: ✅ Ready to Launch  
**Date**: October 19, 2025

---

## What's Already Done ✅

- ✅ **Supabase Database**: 13 migrations applied (all tables, RLS, functions)
- ✅ **Test Users**: 8 pre-loaded users with different roles
- ✅ **.env.local**: Created with Supabase credentials
- ✅ **Realtime**: Already enabled in `lib/task-context.tsx`
- ✅ **Authentication**: Supabase Auth configured

---

## Test Users Available

| Name | Role | Department | ID |
|------|------|------------|-----|
| **Admin User** | admin | — | `00000000-0000-0000-0000-000000000001` |
| **Front Office Staff** | front_office | — | `00000000-0000-0000-0000-000000000002` |
| **Housekeeping Supervisor** | supervisor | housekeeping | `00000000-0000-0000-0000-000000000003` |
| **Maintenance Supervisor** | supervisor | maintenance | `00000000-0000-0000-0000-000000000004` |
| **Maria Garcia** | worker | housekeeping | `00000000-0000-0000-0000-000000000005` |
| **John Smith** | worker | housekeeping | `00000000-0000-0000-0000-000000000006` |
| **Mike Johnson** | worker | maintenance | `00000000-0000-0000-0000-000000000007` |
| **Sarah Lee** | worker | maintenance | `00000000-0000-0000-0000-000000000008` |

---

## Step 1: Start the Development Server

```bash
cd "c:\Users\likhe\Desktop\Projects\Hermes Task Management\hermes-monitoring"
pnpm install
pnpm dev
```

Expected output:
```
  ▲ Next.js 15.0.0
  - Local:        http://localhost:3000
  - Environments: .env.local

✓ Ready in 2.5s
```

---

## Step 2: Test Login

1. **Open browser**: http://localhost:3000
2. **You'll be redirected to**: http://localhost:3000/login
3. **Select a test user** from the dropdown
4. **Click "Login"**

### Expected Behavior by Role

| Role | Expected Route | What You'll See |
|------|---|---|
| **worker** | `/worker` | Task list, "Start Work" button |
| **supervisor** | `/supervisor` | Worker overview, task management |
| **front_office** | `/front-office` | Create new tasks |
| **admin** | `/admin` | System settings, user management |

---

## Step 3: Verify Realtime Connection

### Test 1: Create a Task
1. Go to **Front Office** (login as "Front Office Staff")
2. Click **"Create New Task"**
3. Fill in form:
   - Task Type: `Room Cleaning`
   - Priority: `High`
   - Room Number: `101`
   - Expected Duration: `30 minutes`
4. Click **"Create Task"**

### Test 2: Verify in Database
Go to Supabase Dashboard:
- **URL**: https://wtfnntauwvsgohfmhgyo.supabase.co
- **Path**: Database → **tasks** table
- **You should see** your new task instantly (no refresh needed)

### Test 3: Verify Realtime Sync
1. Open **two browser windows**
2. Window 1: Login as **supervisor**
3. Window 2: Login as **Maria Garcia** (worker)
4. Window 1: Create a new task and assign to Maria
5. Window 2: Should see task appear **instantly** (without refresh)

If it appears instantly → ✅ **Realtime is working!**

---

## Step 4: Test Core Workflows

### Workflow 1: Task Assignment → Completion
**Goal**: Create and complete a task

1. **Create** (As Front Office):
   - Go to `/front-office`
   - Create task with photo required
   
2. **Assign** (As Supervisor):
   - Go to `/supervisor`
   - Assign to a worker (e.g., "Maria Garcia")
   
3. **Accept & Start** (As Worker):
   - Go to `/worker`
   - See assigned task
   - Click "Start"
   
4. **Verify** in Supabase:
   - Check `tasks` table: status should be `IN_PROGRESS`
   - Check `audit_logs` table: should see `TASK_STARTED` action

### Workflow 2: Pause & Resume
**Goal**: Test pause functionality

1. As worker on `/worker`:
   - Click "Pause" on in-progress task
   - Select reason (e.g., "Waiting for materials")
   - Click "Resume"

2. Verify in Supabase:
   - Check `pause_records` table: should see pause entry
   - Check `tasks` table: status back to `IN_PROGRESS`

### Workflow 3: Photo Upload
**Goal**: Test photo storage

1. Create or edit task with "Photo Required" enabled
2. Click "Upload Photo"
3. Select image from device
4. Verify in Supabase:
   - Storage → **task-photos** bucket
   - Photo should appear in bucket

---

## Step 5: Verify Core Features

### ✅ Check Each Feature

- [ ] **Login works** — Can select user and login
- [ ] **Redirect works** — Correct role routes to correct page
- [ ] **Create Task** — Task appears in database
- [ ] **Assign Task** — Task can be assigned to worker
- [ ] **Start Task** — Worker can start task
- [ ] **Pause Task** — Task can be paused and resumed
- [ ] **Complete Task** — Task can be completed with remarks
- [ ] **Upload Photo** — Photo uploads to storage bucket
- [ ] **Realtime Sync** — Changes appear instantly across browsers
- [ ] **Audit Logs** — All actions logged in database

---

## Troubleshooting

### Issue: "Row-level security violated"

**Cause**: User role or metadata not set correctly in Supabase Auth

**Solution**:
1. Go to Supabase Dashboard → Authentication → Users
2. Click the user → Edit User
3. Ensure metadata has correct role:
```json
{
  "role": "worker",
  "department": "housekeeping"
}
```

### Issue: "No users found in dropdown"

**Cause**: App is trying to read from Supabase Auth, not from `users` table

**Solution**:
1. Check `.env.local` is created with Supabase credentials
2. Verify in browser console (F12):
   - No CORS errors
   - No "failed to fetch" errors
3. If still failing, login works via localStorage fallback

### Issue: "Photos not uploading"

**Cause**: Storage policies not set correctly

**Solution**:
1. Go to Supabase Dashboard → Storage → **task-photos**
2. Check **Policies** tab
3. Should have:
   - **PUBLIC**: `SELECT` (anyone can read)
   - **AUTHENTICATED**: `INSERT, UPDATE` (logged-in users can upload)

### Issue: "Realtime not updating across browsers"

**Cause**: Realtime subscriptions not active

**Solution**:
1. Open browser console (F12)
2. Check for `Realtime subscriptions established` message
3. In `lib/task-context.tsx`, verify `isRealtimeEnabled = true`
4. Restart dev server: `pnpm dev`

---

## Performance Testing

### Test 1: Rapid Task Creation
1. Create 10 tasks in succession
2. Check database:
   - `SELECT COUNT(*) FROM tasks;` — should show 10 rows
   - All should have correct data

### Test 2: Realtime Load
1. Open 3 browser windows
2. All logged in as different users
3. In one window: Create 5 tasks rapidly
4. Other windows should see all 5 appear instantly

### Test 3: Photo Upload Performance
1. Create task with photo
2. Upload large image (>10MB)
3. Should complete in < 5 seconds

---

## Database Status Commands

Run these in Supabase → SQL Editor to verify:

```sql
-- Count all tasks
SELECT COUNT(*) as total_tasks FROM tasks;

-- Count all audit logs
SELECT COUNT(*) as total_actions FROM audit_logs;

-- Count all notifications
SELECT COUNT(*) as total_notifications FROM notifications;

-- Check latest 5 tasks
SELECT id, task_type, status, created_at FROM tasks ORDER BY created_at DESC LIMIT 5;

-- Check RLS is enabled
SELECT 
  schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check storage bucket
SELECT * FROM storage.buckets WHERE name = 'task-photos';
```

---

## Next Steps After Basic Testing

### Week 1: Core Workflows
- [ ] Test all role-based workflows (worker, supervisor, admin, front_office)
- [ ] Verify audit logging for all actions
- [ ] Test escalation detection (create task, wait 15+ min in progress)
- [ ] Test notification system

### Week 2: Advanced Features
- [ ] Test shift schedules
- [ ] Test maintenance schedules
- [ ] Test issue reporting
- [ ] Test role-based access (RLS)

### Week 3: Performance & Stability
- [ ] Load test with 50+ concurrent users
- [ ] Test with large datasets (1000+ tasks)
- [ ] Verify backup and recovery procedures
- [ ] Set up monitoring and alerting

### Week 4: Deployment
- [ ] Configure production environment
- [ ] Set up automated backups
- [ ] Enable CDN for photo delivery
- [ ] Deploy to production

---

## Important Files to Reference

| File | Purpose |
|------|---------|
| `.env.local` | Supabase credentials (just created) |
| `lib/task-context.tsx` | State management & Supabase sync |
| `app/page.tsx` | Login/redirect logic |
| `components/protected-route.tsx` | Role-based access control |
| `lib/supabase/client.ts` | Supabase client factory |

---

## Support & Documentation

- **ARCHITECTURE_GUIDE.md** — Full system design
- **SUPABASE_SETUP.md** — Detailed setup instructions
- **.github/copilot-instructions.md** — Code conventions
- **SETUP_COMPLETE.md** — Complete summary

---

## Quick Reference: API Endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| Create Task | `POST /api/tasks` | POST |
| Update Task | `PUT /api/tasks/:id` | PUT |
| Get Tasks | `GET /api/tasks` | GET |
| Upload Photo | `POST /storage/upload` | POST |
| Create User | `POST /auth/signup` | POST |

---

## ✅ Deployment Checklist

When ready to go to production:

- [ ] `.env` configured with production Supabase credentials
- [ ] `isRealtimeEnabled = true` for production
- [ ] RLS policies verified and tested
- [ ] Backups configured (Supabase Settings → Backups)
- [ ] Monitoring alerts set up
- [ ] Email/SMS notifications configured
- [ ] Rate limiting enabled
- [ ] CORS settings reviewed
- [ ] Storage CDN enabled
- [ ] Analytics dashboard ready

---

## Timeline

| Phase | Timeline | Status |
|-------|----------|--------|
| Setup | Day 1 | ✅ Complete |
| Basic Testing | Days 2-3 | 🔄 Now |
| Advanced Testing | Days 4-7 | ⏳ Next |
| Performance Testing | Days 8-10 | ⏳ Pending |
| Production Ready | Day 11+ | ⏳ Pending |

---

## Need Help?

1. **Check browser console** (F12) for errors
2. **Check Supabase logs** (Dashboard → Database → Logs)
3. **Review ARCHITECTURE_GUIDE.md** for entity relationships
4. **Check GitHub issues** in copilot-instructions.md

---

**You're all set! Ready to launch.** 🎉

Next: Run `pnpm dev` and test the first workflow.

