# Maintenance Worker Test Plan

## 1. Prerequisites
-   User account with role `worker` and department `maintenance`.
-   Active maintenance tasks assigned to this user (or unassigned tasks in the system).
-   Maintenance schedule created for the current month.

## 2. Test Scenarios

### A. Dashboard & Navigation
1.  **Login**: Log in as a maintenance worker.
2.  **Verify Dashboard**:
    -   Check if "Scheduled" tab is visible.
    -   Check if "Current Maintenance Task" card appears (if a task is active).
    -   Check "Recently Completed Tasks" section.
3.  **Calendar View**:
    -   Go to "Scheduled" tab.
    -   Verify Block A and Block B sections are collapsible.
    -   Verify room status indicators (Pending, In Progress, Completed).
    -   Search for a specific room number.

### B. Task Execution (The "Happy Path")
1.  **Select Room**: Click on a room in the Calendar.
2.  **View Tasks**: Verify the list of tasks for that room (AC, Fan, etc.) is displayed.
3.  **Start Task**:
    -   Click on a pending task.
    -   Click "Start Task".
    -   Verify timer starts counting.
    -   Verify status changes to "In Progress".
4.  **Pause/Resume**:
    -   Click "Pause". Verify timer stops.
    -   Click "Resume". Verify timer continues.
5.  **Photo Upload**:
    -   Upload a "Room Photo".
    -   Upload a "Proof Photo".
    -   Verify images are displayed and can be removed.
6.  **AC Specifics** (if applicable):
    -   Select AC Location (Hall/Bedroom).
7.  **Completion**:
    -   Click "Complete Task".
    -   Verify task is marked as completed in the list.
    -   Verify "Room Complete" button appears if all tasks are done.

### C. Edge Cases & Validation
1.  **Missing Photos**: Try to complete a task without uploading photos. Verify error message.
2.  **Missing AC Location**: Try to complete an AC task without selecting location. Verify error message.
3.  **Raise Issue**:
    -   Click "Raise Issue".
    -   Submit an issue description.
    -   Verify issue is logged (check notes or issue list).
4.  **Offline/Network**: (Optional) Test behavior with poor network connection (if possible).

## 3. Manual Verification Steps
Since automated testing is limited, perform these steps manually in the browser:
1.  Navigate to `/worker`.
2.  Use the UI to perform the actions listed above.
3.  Check Console logs for any errors.
4.  Check Network tab for failed requests.
