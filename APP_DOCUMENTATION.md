# Hermes Task Management System - Application Overview

## 1. Executive Summary
**Hermes Task Management** is a comprehensive, role-based application designed for resort and hotel operations. It streamlines communication and task execution between different departments (Housekeeping, Maintenance, Front Office) and management layers (Admin, Manager, Supervisor).

The system features real-time task tracking, complex shift management, automated escalations for service delays, and detailed analytics. It is built to ensure high service quality, accountability, and operational efficiency.

---

## 2. Technology Stack

### Frontend
-   **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
-   **Language:** TypeScript
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with `tailwindcss-animate`
-   **UI Components:** [Radix UI](https://www.radix-ui.com/) (via shadcn/ui patterns)
-   **Icons:** [Lucide React](https://lucide.dev/)
-   **Charts:** [Recharts](https://recharts.org/)
-   **Animations:** [Framer Motion](https://www.framer.com/motion/)
-   **Forms:** React Hook Form + Zod validation

### Backend & Data
-   **Platform:** [Supabase](https://supabase.com/)
-   **Database:** PostgreSQL
-   **Real-time:** Supabase Realtime (for live task updates)
-   **Authentication:** Supabase Auth
-   **State Management:** React Context + LocalStorage Caching (Optimistic UI)

---

## 3. Core Features by Role

The application is divided into distinct dashboards tailored to specific operational roles.

### 👑 Admin
*The central command center for system configuration and high-level oversight.*
-   **Worker Management:** Add/Edit workers, manage profiles, and configure shift schedules.
-   **System Analytics:**
    -   **Live Dashboard:** Active tasks, staff availability, and pending items.
    -   **Performance Metrics:** Completion rates, average duration, and rating analysis by department.
    -   **Trends:** Hourly distribution and monthly performance reports.
-   **Audit Logs:** Full history of actions and status changes for accountability.
-   **Maintenance Schedule:** Oversee preventive maintenance calendars.

### 👔 Manager
*Focuses on operational efficiency and task delegation.*
-   **Task Creation:** Advanced task assignment with priority levels and categories.
-   **Task Library:** Pre-defined templates for recurring checklists and custom workflows.
-   **Monitoring:** Track "Pending," "In Progress," and "Completed" tasks in real-time.
-   **My Assignments:** Track tasks assigned *by* the manager to ensure they are completed.

### 🛡️ Supervisor
*Ensures service quality and handles operational roadblocks.*
-   **Escalation Management:**
    -   **Automated Alerts:** Triggers at 15m, 20m, and 50% overtime.
    -   **Critical Notifications:** Immediate alerts for tasks crossing critical thresholds.
-   **Quality Control:** Review rejected tasks and provide feedback.
-   **Staff Monitoring:** View real-time status of workers under their supervision.

### 🛎️ Front Office
*The bridge between guests and operations.*
-   **Guest Requests:** Rapidly log guest issues (e.g., "AC not working," "Extra towels") as high-priority tasks.
-   **Shift Management:**
    -   **Complex Scheduling:** Manage dual shifts (morning/evening split) and break times.
    -   **Live Roster:** See who is currently On Duty, Off Duty, or on Break.
-   **Task Reassignment:** Quickly reallocate tasks if a worker is unavailable.

### 👷 Worker
*The mobile-first interface for executing tasks.*
-   **Task Execution:**
    -   **Simple Workflow:** Start -> Pause (with reason) -> Complete.
    -   **Verification:** Upload photos (Before/After/Proof) to verify work.
-   **Maintenance Mode:** Specialized views for room-specific maintenance (AC, Electrical, Plumbing).
-   **Performance Tracking:**
    -   **Rejection Quota:** Visual tracker for rejected tasks (Quality Control).
    -   **Stats:** Personal completion rate, on-time rate, and average rating.
-   **Offline Support:** Robust caching allows viewing tasks even with spotty internet.

---

## 4. Key Sub-Systems

### 🔄 Real-time Synchronization
The app uses a sophisticated `useRealtimeTasks` hook that:
1.  Subscribes to Supabase Postgres Changes.
2.  Optimistically updates the UI.
3.  Debounces updates to prevent UI jitter.
4.  Syncs with LocalStorage to provide an "offline-first" feel.

### 📅 Shift Management
A complex logic engine handles:
-   **Standard Shifts:** e.g., 9:00 AM - 5:00 PM.
-   **Dual Shifts:** e.g., 8:00 AM - 12:00 PM & 4:00 PM - 8:00 PM.
-   **Breaks:** Tracking break start/end times.
-   **Overrides:** Handling holidays, sick leave, or emergency off-duty status.

### 🚨 Escalation Engine
A background process runs on the Supervisor dashboard to monitor active tasks:
-   **Level 1:** Task running > 15 mins (Check-in needed).
-   **Level 2:** Task running > 20 mins (Assistance may be required).
-   **Level 3:** Task > 50% over expected duration (Critical delay).

### 📸 Photo Verification
Tasks often require photographic proof:
-   **Categorized Photos:** "Room Photos," "Proof of Completion," "Before/After."
-   **Caching:** Photos are cached locally to reduce bandwidth and improve load times.

---

## 5. Data Architecture

### Core Entities
-   **Users:** `id`, `role`, `department`, `shift_schedule`.
-   **Tasks:** `id`, `status` (PENDING, IN_PROGRESS, COMPLETED, etc.), `priority`, `timestamps` (client/server dual timestamps for anti-tampering).
-   **MaintenanceTasks:** Specialized tasks linked to specific room assets.
-   **ShiftSchedules:** Daily records of worker shifts.
-   **AuditLogs:** Immutable record of who did what and when.

### Security
-   **Row Level Security (RLS):** Supabase policies ensure users only access data relevant to their role and department.
-   **Dual Timestamps:** Tracks both Client time (for UI) and Server time (for truth) to prevent manipulation of performance metrics.

---

## 6. Directory Structure
-   `/app`: Next.js App Router pages (organized by role: `admin`, `manager`, `worker`, etc.).
-   `/components`: Reusable UI components (shadcn/ui) and feature-specific widgets.
-   `/lib`:
    -   `task-context.tsx`: Massive state machine handling global app state.
    -   `supabase-task-operations.ts`: Database interaction layer.
    -   `types.ts`: TypeScript definitions for the entire domain model.
