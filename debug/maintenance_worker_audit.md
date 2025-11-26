# Maintenance Worker Role Audit

## 1. Scope
Focus on the "Worker" role specifically within the "Maintenance" department.
Key features to verify:
- Viewing assigned maintenance tasks.
- Viewing the maintenance calendar.
- Task execution flow (Start -> Pause -> Complete).
- Photo verification for maintenance tasks.
- Handling of specialized maintenance types (AC, Plumbing, etc.).

## 2. Code Analysis
### Key Files
- `app/worker/page.tsx`: Main dashboard.
- `components/maintenance-calendar.tsx`: (Verify existence/location).
- `lib/maintenance-types.ts`: Data models.
- `lib/task-context.tsx`: State management for maintenance tasks.

### Findings
-   **Dashboard (`app/worker/page.tsx`)**:
    -   Detects maintenance users via `user.department === 'maintenance'`.
    -   Displays "Recently Completed Tasks" and a "Current Maintenance Task" card.
    -   "Scheduled" tab renders `MaintenanceCalendar`.
-   **Calendar (`components/maintenance/maintenance-calendar.tsx`)**:
    -   Visualizes tasks by Block (A/B) and Floor.
    -   Clicking a room navigates to `/worker/maintenance/[roomNumber]`.
-   **Task Execution Page (`app/worker/maintenance/[roomNumber]/[taskType]/[location]/page.tsx`)**:
    -   Full-screen view for a specific task.
    -   Handles Timer, Photos (via `CategorizedPhotoCaptureModal`), Remarks, and Issues.
    -   Logic seems to duplicate `RoomTaskModal` but with more robust state management (e.g., `lastHydratedTaskIdRef`).
-   **Task Execution Modal (`components/maintenance/room-task-modal.tsx`)**:
    -   Used in `app/maintenance/calendar/page.tsx` (likely for Admin/Manager/Supervisor roles).
    -   NOT used in the Worker flow, which uses the full page above.
    -   **Potential Issue**: Logic duplication between this modal and the worker page. Updates to one might be missed in the other.
-   **Data Models (`lib/maintenance-types.ts`)**:
    -   Defines `MaintenanceTask`, `MaintenanceSchedule`, and types like `ac_indoor`, `ac_outdoor`.

## 3. Potential Issues / Questions
- How are maintenance tasks differentiated from regular tasks in the UI?
- Is the "Maintenance Mode" explicitly defined or just a filter?
- Are there specific checklists for different maintenance types?

## 4. Test Plan
1.  **Login as Maintenance Worker**: Verify dashboard loads correct data.
2.  **View Tasks**: Check if maintenance tasks appear with correct details (room, type, urgency).
3.  **Start Task**: Verify status update and timer start.
4.  **Pause Task**: Test pause functionality with reason.
5.  **Complete Task**:
    -   Verify photo upload requirements.
    -   Check if "Categorized Photos" are handled correctly for maintenance.
6.  **Calendar**: Verify schedule visibility.
