# CERTIFY — Certificate Management System
# User Manual

**Version 1.0 — UAT Edition**
**System:** CERTIFY · Department Certificate Management System
**Stack:** React 18 · Node.js · PostgreSQL 16
**Audience:** College department administrators, faculty, and students

---

## Before You Start

Before logging in, verify all three services are running:

| Service | Default URL | How to check |
|---|---|---|
| PostgreSQL 16 | `localhost:5432` | `pg_ctl status -D D:\DB\data` |
| Backend API | `http://localhost:5001/api` | Open `http://localhost:5001/api/health` — should return `{"status":"OK","db":"connected"}` |
| Frontend | `http://localhost:5173` | Open `http://localhost:5173` — the login page should appear |

> ⚠️ **Security notice:** Production credentials (passwords, JWT secrets, database passwords) must never be written in this manual or any shared document. Use a secure password manager.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles and Permissions](#2-user-roles-and-permissions)
3. [Login](#3-login)
4. [First-Time System Setup — Recommended Order](#4-first-time-system-setup)
5. [Creating Departments](#5-creating-departments)
6. [Creating Academic Years](#6-creating-academic-years)
7. [Creating Classes](#7-creating-classes)
8. [Creating Admin Accounts](#8-creating-admin-accounts)
9. [Creating Coordinating Faculty Accounts](#9-creating-coordinating-faculty-accounts)
10. [Creating Class Advisor Accounts](#10-creating-class-advisor-accounts)
11. [Assigning Class Advisors to Classes](#11-assigning-class-advisors-to-classes)
12. [Creating Student Accounts — Individual](#12-creating-student-accounts--individual)
13. [Bulk Student Import](#13-bulk-student-import)
14. [Creating Class Representative Accounts](#14-creating-class-representative-accounts)
15. [Student Login](#15-student-login)
16. [Creating On-Duty Records](#16-creating-on-duty-records)
17. [Viewing and Managing OD Records](#17-viewing-and-managing-od-records)
18. [Uploading Certificates](#18-uploading-certificates)
19. [Certificate Replacement and Version History](#19-certificate-replacement-and-version-history)
20. [Certificate Statuses](#20-certificate-statuses)
21. [Late Certificate Submission](#21-late-certificate-submission)
22. [Certificate Verification and Rejection](#22-certificate-verification-and-rejection)
23. [Class Advisor Workflow](#23-class-advisor-workflow)
24. [Class Representative Workflow](#24-class-representative-workflow)
25. [Coordinating Faculty Workflow](#25-coordinating-faculty-workflow)
26. [Admin Workflow](#26-admin-workflow)
27. [Super Admin Workflow](#27-super-admin-workflow)
28. [Academic Year Promotion](#28-academic-year-promotion)
29. [Student Academic History](#29-student-academic-history)
30. [Reports](#30-reports)
31. [Audit Log](#31-audit-log)
32. [Searching, Filtering, and Pagination](#32-searching-filtering-and-pagination)
33. [Account and Security Practices](#33-account-and-security-practices)
34. [Logout and Session Handling](#34-logout-and-session-handling)
35. [Troubleshooting](#35-troubleshooting)
36. [UAT Checklist](#36-uat-checklist)
37. [Recommended Operational Sequence](#37-recommended-operational-sequence)
38. [Role-Permission Matrix](#38-role-permission-matrix)
39. [End-to-End Example](#39-end-to-end-example)

---

## 1. System Overview

CERTIFY is a web-based Certificate Management System for college departments. It manages:

- **On-Duty (OD) registrations** — Individual and team OD records for events, conferences, and workshops
- **Certificate submissions** — Students upload proof-of-participation certificates against their OD records
- **Certificate lifecycle** — Deadline tracking, overdue marking, late submission handling, verification/rejection
- **Role-based access** — 7 distinct roles from Super Admin to Student, each with scoped permissions
- **Reports** — Monthly summaries, certificate status reports, class-wise and department-wise OD reports
- **Audit trail** — Every data mutation is recorded with actor, timestamp, and before/after values
- **Academic history** — Tracks a student's enrollment across academic years and class promotions

---

## 2. User Roles and Permissions

| Role | Login Method | Primary Responsibilities |
|---|---|---|
| **Super Admin** | Username + Password | Full system access: org structure, all management, audit |
| **Admin** | Username + Password | Student and faculty management, OD and certificate oversight |
| **Coordinating Faculty** | Username + Password | OD oversight, certificate coordination, monthly reports and exports |
| **Class Advisor** | Username + Password | Own class: students, ODs, certificates, bulk import, reports |
| **Class Representative** | Register Number + DOB | Own class: OD registration, certificate upload on behalf of students |
| **Student Representative** | Username + Password | OD registration for any student (legacy workflow via `/api/od-records`) |
| **Student** | Register Number + Date of Birth | View own ODs, upload/download own certificates |

> **Note on Student Representative:** This role uses the legacy `od-records` API (not the newer `ods` API). It is included for backward compatibility. New OD registrations should use Class Advisor or Class Representative roles.

---

## 3. Login

### Step 1 — Open the system

Navigate to `http://localhost:5173` in your browser (Chrome, Firefox, or Edge recommended).

### Step 2 — Select your tab

The login page has two tabs:

- **Staff / Admin** — for Super Admin, Admin, Coordinating Faculty, Class Advisor, Class Representative, Student Representative
- **Student** — for Students

### Step 3 — Select your role (Staff/Admin tab only)

Click the role selector dropdown and choose your role. The hint text below the role name confirms the role's purpose.

### Step 4 — Enter credentials

**Staff/Admin roles:**
- Username / Email: your assigned username (e.g. `faculty@college.edu`)
- Password: your assigned password

**Student role:**
- Registration Number: your institutional register number (e.g. `22CS001`)
- Date of Birth: in `YYYY-MM-DD` format (e.g. `2004-06-15`)

**Class Representative:**
- Uses the **Student** tab? No — Class Representatives log in on the **Staff/Admin** tab, selecting "Class Representative" as the role.
- Username: their student register number
- Password: their date of birth (`YYYY-MM-DD`)

### Step 5 — Click Sign In

On success you are redirected to your role-specific dashboard.

**If login fails:**
- Verify the correct tab is selected (Staff/Admin vs Student).
- Verify the role selector matches your actual role.
- Students: confirm the date of birth format is exactly `YYYY-MM-DD`.
- Contact an Admin if your account is inactive.

---

## 4. First-Time System Setup

On a fresh database, follow this exact order:

```
1. Super Admin account (via bootstrap)
2. Departments
3. Academic Years
4. Classes
5. Admin accounts (optional)
6. Coordinating Faculty accounts
7. Class Advisor accounts
8. Assign Class Advisors to Classes
9. Import / create Students
10. Assign Class Representatives
11. (System is ready for OD registration)
```

> The Super Admin account is created once using `node src/utils/bootstrap-admin.js` before the backend starts. All subsequent accounts are created through the UI.

---

## 5. Creating Departments

**Who can do this:** Super Admin, Admin

### Step 1 — Navigate to Org Structure

Log in as Super Admin or Admin → in the left sidebar click **Departments** (or go to **Management → Org Structure tab**).

### Step 2 — Fill in the Department form

In the **Departments** card on the left side of the Org Structure tab:

| Field | Required | Example |
|---|---|---|
| Name | ✅ | `Computer Science and Engineering` |
| Code | ✅ | `CSE` |

> **Code** must be unique across all departments. It is automatically converted to UPPERCASE.

### Step 3 — Click Create Department

On success the new department appears in the list below the form.

**If it fails:**
- Check the code is not already in use.
- Ensure you are logged in as Super Admin or Admin.
- If you see "Failed" with no detail, check the browser Network tab for the exact HTTP status and error body.

---

## 6. Creating Academic Years

**Who can do this:** Super Admin, Admin

### Step 1 — Navigate to Org Structure

Same page as departments — the middle card is **Academic Years**.

### Step 2 — Fill in the form

| Field | Required | Example |
|---|---|---|
| Name | ✅ | `2026-27` |
| Start Date | ❌ | `2026-06-01` |
| End Date | ❌ | `2027-05-31` |

> Name must be unique. Start date must be before end date if both are provided.

### Step 3 — Click Create Academic Year

The new year appears in the list. Active years show an **Active** badge.

**Activating / Deactivating an academic year:**
- Each year in the list shows an **Activate** or **Deactivate** button.
- Multiple years can be active simultaneously.
- Deactivating a year sets its `end_date` to today if not already set.

---

## 7. Creating Classes

**Who can do this:** Super Admin, Admin

### Step 1 — Org Structure → Classes card (right column)

### Step 2 — Fill in the form

| Field | Required | Example |
|---|---|---|
| Department | ✅ | `Computer Science and Engineering` |
| Academic Year | ✅ | `2026-27` |
| Year of Study | ✅ | `2nd Year` |
| Section | ✅ | `A` |
| Display Name | ✅ | `CSE-A` |

> The combination of Department + Academic Year + Year of Study + Section must be unique.

### Step 3 — Click Create Class

The class appears in the list with its department and academic year.

---

## 8. Creating Admin Accounts

**Who can do this:** Super Admin

### Step 1 — Navigate to Admin Dashboard

Log in as Super Admin → sidebar → **Dashboard** (or navigate to `/admin`).

### Step 2 — Select the Coordinating Faculty or Advisors tab

The Admin Dashboard (`/admin`) allows the Super Admin to:
- Create **Coordinating Faculty** accounts (Faculty / Advisors tab)
- Create **Class Advisor** accounts (Faculty / Advisors tab)

> Creating another **Admin** account: this is done via the `bootstrap-admin.js` utility or directly in the database. There is no UI for creating Admin accounts in the current version.

---

## 9. Creating Coordinating Faculty Accounts

**Who can do this:** Super Admin, Admin

### Step 1 — Navigate to Admin Dashboard → Faculty / Advisors

Sidebar → **Dashboard** (for Admin role) → select the **Coordinating Faculty** tab.

### Step 2 — Fill in the creation form

| Field | Required | Notes |
|---|---|---|
| Username / Email | ✅ | e.g. `faculty@college.edu` — must be unique |
| Password | ✅ | Minimum 8 characters |

### Step 3 — Click Create

The new account appears in the list below. It is active immediately.

**Deactivating / Activating:** Click the **Deactivate** / **Activate** toggle button next to any account.

---

## 10. Creating Class Advisor Accounts

**Who can do this:** Super Admin, Admin

### Step 1 — Admin Dashboard → Faculty / Advisors → Class Advisors tab

### Step 2 — Fill in the form

| Field | Required | Notes |
|---|---|---|
| Username / Email | ✅ | e.g. `advisor.cse@college.edu` — must be unique |
| Password | ✅ | Minimum 8 characters |

### Step 3 — Click Create

> After creating the account, you must assign the advisor to a class (see Section 11).

---

## 11. Assigning Class Advisors to Classes

**Who can do this:** Super Admin, Admin

### Step 1 — Management Dashboard → Advisors tab

Log in as Super Admin → sidebar → **Class Advisors** → you will see the **Advisors** tab of the Management Dashboard.

### Step 2 — Fill in the assignment form

| Field | Required | Notes |
|---|---|---|
| Class | ✅ | Select from dropdown (e.g. `CSE-A · 2026-27`) |
| Faculty | ✅ | Select from the list of active faculty/advisors |
| Reason | ❌ | Optional note for the audit log |

### Step 3 — Click Assign

The assignment is recorded. If a class already has an active advisor, the old assignment is closed and the new one takes effect immediately. The full assignment history is preserved.

**View advisor history:** Select a class in the Advisor History section and click **Load**.

---

## 12. Creating Student Accounts — Individual

**Who can do this:** Super Admin, Admin, Class Advisor (own class only)

### Step 1 — Management Dashboard → Students tab → Add Student

### Step 2 — Fill in the form

| Field | Required | Notes |
|---|---|---|
| Register Number | ✅ | e.g. `22CS001` — must be unique across all students |
| Full Name | ✅ | e.g. `Priya Sharma` |
| Date of Birth | ✅ | `YYYY-MM-DD` — **this becomes the student's login password** |
| Class | ✅ | Select the class (e.g. `CSE-A · 2026-27`) |

### Step 3 — Click Add Student

The system automatically:
- Creates the `students` record
- Creates a `users` record (role=`student`, username=register_number, password=DOB hash)
- Creates the initial `student_academic_history` record

> **Important:** The student's Date of Birth is their login password. Protect this information appropriately.

---

## 13. Bulk Student Import

**Who can do this:** Super Admin, Admin, Class Advisor (own class only)

This is the recommended method for importing an entire class at once.

### Step 1 — Prepare your Excel or CSV file

The file must have exactly these column headers (case-insensitive):

| Column | Required | Format | Example |
|---|---|---|---|
| `register_number` | ✅ | Text | `22CS001` |
| `name` | ✅ | Text | `Priya Sharma` |
| `date_of_birth` | ✅ | `YYYY-MM-DD` | `2004-06-15` |

Additional columns (e.g. `department`, `year`, `section`) are ignored — these are derived from the selected class.

> A template file `student-data-template.xlsx` is provided in the project root.

### Step 2 — Management Dashboard → Bulk Import tab

### Step 3 — Select the target class

Choose the class from the **Target Class** dropdown. All students in this file will be assigned to that class.

### Step 4 — Upload the file

Click the file input and select your `.xlsx` or `.csv` file (max 10 MB).

### Step 5 — Click Preview Import

The system validates each row and shows a summary:
- **Total**: rows in file
- **Valid**: rows that will be imported
- **Duplicates**: register numbers already in the database
- **Invalid**: rows with missing fields or bad date format

Invalid and duplicate rows are shown with their specific error. Correct the source file and re-upload if needed.

### Step 6 — Click Confirm Import

Only runs if all rows are valid. Imports all students atomically — either all succeed or none are imported.

Each imported student automatically gets:
- A login account (username = register_number, password = date_of_birth)
- An academic history record

---

## 14. Creating Class Representative Accounts

**Who can do this:** Super Admin, Admin, Class Advisor (own class)

This is a two-step process:

### Step A — Assign the student as CR

**Management Dashboard → Representatives tab**

1. Select the class from the dropdown.
2. In the **Assign Class Representative** card, select an active student from the dropdown.
3. Click **Assign as CR**.

### Step B — Create the CR login account

In the **Current Class Representatives** list, click **Create Login** next to the student.

The system creates a `class_representative` user account:
- Username: the student's register number
- Password: the student's date of birth

> The CR logs in on the **Staff/Admin** tab, selecting "Class Representative", with their register number and DOB.

---

## 15. Student Login

Students log in on the **Student** tab of the login page:

- **Registration Number**: their institutional register number (e.g. `22CS001`)
- **Date of Birth**: in `YYYY-MM-DD` format (e.g. `2004-06-15`)

After login, students land on their **Student Dashboard** showing:
- Total OD count, Active OD count, Certificate count
- List of their OD records
- Certificate upload form (for the legacy `od-records` system)
- Certificate history with download links

> For the newer OD system (`/ods`), students navigate to **My On-Duty Records** in the sidebar.

---

## 16. Creating On-Duty Records

**Who can do this:** Super Admin, Admin, Class Advisor, Class Representative

### Step 1 — Navigate to Register OD

Sidebar → **Register OD** (or navigate to `/ods/create`).

### Step 2 — Select OD Type

| Type | Use when |
|---|---|
| **Individual OD** | One student for one event |
| **Team OD** | Multiple students for the same event |

### Step 3 — Fill in Event Information

| Field | Required | Notes |
|---|---|---|
| Event Name | ✅ | e.g. `National Hackathon 2026` |
| Event Type | ✅ | Conference / Workshop / Competition / Internship / Symposium / Other |
| Event Date | ✅ | The actual date of the event (`YYYY-MM-DD`) |
| OD Start Date | ✅ | First day the student is absent (`YYYY-MM-DD`) |
| OD End Date | ✅ | Last day the student is absent (`YYYY-MM-DD`) |
| Purpose | ✅ | Free text describing the participation |
| Venue | ❌ | Location of the event |

> Constraint: `event_date` must fall within `od_start_date` to `od_end_date + 30 days`.

### Step 4 — Select Class (Admin/Faculty only)

Global roles (Super Admin, Admin, Coordinating Faculty) must select a class. Class-scoped roles (Class Advisor, Class Representative) have their class pre-selected.

### Step 5 — Add Participants

Type a register number or name in the search box. Results appear as a dropdown — click a student to add them.

- **Individual mode**: selecting a new student replaces the previous selection.
- **Team mode**: multiple students can be added; each appears in the participant table.

All participants must be **active students** in the selected class.

### Step 6 — Click Create OD

On success you are redirected to the OD detail page showing the generated OD number (format: `OD-YYYY-NNNNNN`).

---

## 17. Viewing and Managing OD Records

**Who can access:** All authenticated roles (scoped by their permissions)

### Navigating to OD Records

Sidebar → **On-Duty Records** (or `/ods`).

### Filters available

| Filter | Notes |
|---|---|
| Search | Search by OD number or event name |
| Event Type | Conference / Workshop / Competition / Internship / Symposium / Other |
| Status | Active / Cancelled |
| From Date | Filter ODs with event date ≥ this date |

Click **Search** to apply. Click **Reset** to clear all filters.

### Cancelling an OD

**Who can cancel:** Super Admin, Admin, Class Advisor (own class), Coordinating Faculty

1. Navigate to the OD detail page (click the OD number).
2. Click the **Cancel OD** button (visible to authorised roles).
3. Enter a mandatory cancellation reason.
4. Confirm.

Cancelled ODs remain visible. Participants and certificate records are preserved.

---

## 18. Uploading Certificates

**Who can upload:** Student (own ODs), Class Representative (on behalf of students in their class)

### Student workflow

1. Sidebar → **Upload Certificate** (or `/certificates/upload`).
2. Select the OD from the dropdown (shows your active ODs).
3. Drag-and-drop or click to browse for the certificate file.
   - **Accepted formats:** PDF, JPG, PNG
   - **Maximum size:** 5 MB
4. If the deadline has passed, a late submission warning appears — enter a reason (required).
5. Click **Upload Certificate**.

### Class Representative workflow

1. Navigate to `/ods` → find the OD → click the OD number.
2. On the OD detail page, click **Upload Certificate** for the specific student.
3. The CR submits on behalf of the student; the student is correctly attributed.

**Certificate deadline rule:** The deadline is the last calendar day of the month in which the OD end date falls. Example: OD end date `2026-11-15` → deadline `2026-11-30`.

---

## 19. Certificate Replacement and Version History

**Who can replace:** The original submitter (student or CR) — only if the certificate is **not yet verified**.

### Replacing a certificate

1. Navigate to **My Certificates** → click the certificate.
2. On the detail page, click **Replace Certificate**.
3. Upload the new file.

The old file is preserved in version history. The version number increments.

### Viewing version history

Navigate to the certificate detail page → the **Version History** section shows all previous versions with timestamps.

> Verified certificates **cannot** be replaced.

---

## 20. Certificate Statuses

| Status | Meaning |
|---|---|
| `pending` | OD exists but no certificate has been submitted yet |
| `submitted` | Certificate uploaded, awaiting staff review |
| `late_submitted` | Certificate uploaded after the deadline, awaiting late approval |
| `verified` | Certificate approved by staff |
| `rejected` | Certificate rejected by staff (reason provided) |
| `overdue` | Deadline passed and no certificate submitted |

Status transitions are enforced by the backend and cannot be skipped.

---

## 21. Late Certificate Submission

When a student submits a certificate after the deadline:

1. The upload page shows an amber warning: "The certificate deadline has passed."
2. A **Late Submission Reason** text field appears (required).
3. The student enters a reason (e.g. "Medical emergency — hospital admission").
4. On submission the certificate status becomes `late_submitted`.
5. A Class Advisor, Admin, or Coordinating Faculty must approve or reject the late submission.

**Approving a late submission:**
1. Navigate to **Certificates** → filter by status `late_submitted`.
2. Click the certificate → click **Approve Late Submission**.
3. Status changes to `submitted` (awaiting final verification).

**Rejecting a late submission:**
1. Same navigation → click **Reject Late**.
2. A rejection reason is required.
3. Status changes to `rejected`.

---

## 22. Certificate Verification and Rejection

**Who can verify/reject:** Super Admin, Admin, Coordinating Faculty, Class Advisor (own class only)

### Verifying a submitted certificate

1. Sidebar → **Certificates** (or navigate to `/certificates`).
2. Find certificates with status `submitted`.
3. Click the certificate to open the detail page.
4. Click **Verify** — status changes to `verified`.

### Rejecting a certificate

1. On the certificate detail page, click **Reject**.
2. Enter a rejection reason (required, e.g. "Certificate does not match the event").
3. Status changes to `rejected`.
4. The student can upload a replacement (since the certificate is not verified).

> Only `submitted` certificates can be directly verified. `late_submitted` certificates must be approved-late first.

---

## 23. Class Advisor Workflow

After logging in, the Class Advisor is redirected to the **Management Dashboard** showing their assigned class.

**Available actions:**

| Action | Location |
|---|---|
| View class students | Students tab |
| Add individual student | Students tab → Add Student |
| Bulk import students | Bulk Import tab |
| View/create OD records | On-Duty Records (sidebar) |
| Register a new OD | Register OD (sidebar) |
| View/verify certificates | Certificates (sidebar) |
| Assign Class Representatives | Representatives tab |
| Create CR login account | Representatives tab → Create Login |
| View reports | Reports (sidebar) |
| Assign advisor to class | Advisors tab (can see but not reassign themselves) |

---

## 24. Class Representative Workflow

After logging in, the CR is redirected to `/class-rep` showing their class dashboard with student roster and OD quick links.

**Available actions:**

| Action | Location |
|---|---|
| View class roster | My Class tab (sidebar) |
| View OD records | On-Duty Records (sidebar) |
| Register a new OD | Register OD (sidebar) |
| Upload certificate on behalf of student | Certificates (sidebar) → Upload |
| View own certificates | My Certificates (sidebar) |

> CRs can only see ODs and students in their own class. They **cannot** verify certificates or access management tabs.

---

## 25. Coordinating Faculty Workflow

After logging in, the Coordinating Faculty is redirected to `/faculty`.

**Available actions:**

| Action | Location |
|---|---|
| View OD records (all classes in scope) | On-Duty Records (sidebar) |
| View certificates | Certificates (sidebar) |
| Verify / reject certificates | Certificate detail page |
| Approve / reject late submissions | Certificate detail page |
| Generate monthly summary report | Reports (sidebar) |
| Export Excel report | Reports → Export Excel |
| Download certificates ZIP | Reports → Download ZIP |
| Create Student Representative accounts | Faculty Dashboard → Create Representative form |

---

## 26. Admin Workflow

After logging in, the Admin is redirected to `/admin`.

**Available actions:**

| Action | Location |
|---|---|
| Create Coordinating Faculty accounts | Admin Dashboard → Coordinating Faculty tab |
| Create Class Advisor accounts | Admin Dashboard → Class Advisors tab |
| Activate / Deactivate staff accounts | Admin Dashboard → toggle button |
| Manage students | Management Dashboard → Students tab |
| Manage class representatives | Management Dashboard → Representatives tab |
| Assign class advisors to classes | Management Dashboard → Advisors tab |
| View OD records | On-Duty Records (sidebar) |
| View / verify certificates | Certificates (sidebar) |
| View reports | Reports (sidebar) |
| View audit log | Audit Log (sidebar) |

---

## 27. Super Admin Workflow

The Super Admin has the broadest access. After logging in, they land on the **Management Dashboard**.

**Unique Super Admin capabilities (not available to Admin):**

| Action | Location |
|---|---|
| Create departments | Org Structure tab → Departments |
| Create academic years | Org Structure tab → Academic Years |
| Activate / deactivate academic years | Org Structure tab → Academic Years → buttons |
| Create classes | Org Structure tab → Classes |
| Bulk-promote students across academic years | Org Structure tab → Academic Years → Promote Students |
| Permanently delete inactive students | Students tab → Delete button (only if no OD/cert records) |
| View full audit log | Audit Log (sidebar) |

All Admin capabilities are also available.

---

## 28. Academic Year Promotion

**Who can do this:** Super Admin, Admin

Promotion moves all ACTIVE students in a source class to a new destination class in a different academic year. Historical OD records and certificates remain linked to the original class.

### Step 1 — Org Structure → Academic Years

### Step 2 — Click Promote Students on the source year

### Step 3 — Fill in the promotion form

| Field | Required | Notes |
|---|---|---|
| Target Academic Year | ✅ | Must be a different year from the source |
| Class Mappings | ✅ | At least one From Class → To Class pair |
| Notes | ❌ | Optional reason for the promotion batch |

**Class Mappings example:**
- From: `CSE-A · 2025-26` → To: `CSE-A · 2026-27`
- From: `CSE-B · 2025-26` → To: `CSE-B · 2026-27`

### Step 4 — Click Promote Students

The system:
1. Updates each student's `class_id` and `academic_year_id` to the destination class.
2. Creates a `promoted` exit record in `student_academic_history` for the source year.
3. Creates an `active` enrollment record in `student_academic_history` for the target year.
4. Records a promotion batch in `academic_year_promotions`.
5. Logs an audit event.

> Only **ACTIVE** students are promoted. INACTIVE, GRADUATED, and TRANSFERRED students are skipped.

---

## 29. Student Academic History

Every student maintains a timeline of their enrollment across academic years.

**Viewing a student's academic history:**

1. Management Dashboard → Students tab.
2. Find the student in the table.
3. Click the **History** button.
4. A modal shows each academic year with class, department, year of study, section, enrollment date, and status.

**Status values:**
- `active` — currently enrolled in this academic year
- `promoted` — moved to next year via bulk promotion
- `graduated` — marked as graduated
- `transferred` — transferred out
- `inactive` — deactivated

---

## 30. Reports

**Who can access:** Super Admin, Admin, Coordinating Faculty, Class Advisor

Sidebar → **Reports** (or `/reports`).

### Available report types

| Report | Who can use | Description |
|---|---|---|
| Monthly OD Report | Coordinating Faculty | All OD records for a given month with certificate submission status |
| Certificate Status Report | All report roles | Certificate submission status filtered by class/status |
| Pending Certificates | All report roles | Certificates awaiting submission or review |
| Overdue Certificates | All report roles | Students who missed the certificate deadline |
| Class-Wise OD Report | All report roles | All ODs for a specific class within a date range |
| Student OD History | All report roles | Complete OD records for a specific student |
| Department-Wise Report | All report roles | OD and certificate overview by department |

### Generating a report

1. Select the report type from the left panel.
2. Fill in the filters (month, class, date range, status, etc.).
3. Click **Generate Report**.
4. Results appear in the right panel with pagination.

### Exporting (Coordinating Faculty only)

On the **Monthly OD Report**, two additional buttons appear:
- **Export Excel** — downloads an `.xlsx` file with all OD records for the selected month.
- **Download ZIP** — downloads a `.zip` archive of all submitted certificate files for the month.

---

## 31. Audit Log

**Who can access:** Super Admin, Admin

Sidebar → **Audit Log** (or `/audit`).

The audit log shows every data mutation in the system with:
- Timestamp
- Actor (username of who performed the action)
- Action (e.g. `student_created`, `CERTIFICATE_VERIFIED`, `academic_year_promotion`)
- Target entity and ID
- Details / reason

### Filtering the audit log

| Filter | Notes |
|---|---|
| Search | Matches actor username, action, entity name, or details |
| Action filter | Dropdown of known action types |
| Entity filter | Dropdown of entity types (student, class, department, etc.) |

Click **Refresh** to reload the latest entries. Click any row to open the full detail modal showing old and new data values.

---

## 32. Searching, Filtering, and Pagination

Most list views support:

- **Search box** — type to filter by name, register number, OD number, etc.
- **Dropdown filters** — status, class, event type, etc.
- **Date filters** — from date, to date
- **Pagination** — "Showing X–Y of Z records" with Previous/Next and numbered page buttons

Click **Search** or **Reset** to apply or clear filters.

---

## 33. Account and Security Practices

- **Never share passwords.** Each user should have their own credentials.
- **Student passwords are their Date of Birth.** Treat DOB data with appropriate care under applicable data protection regulations.
- **Staff passwords** must be at least 8 characters. Use longer passwords for production.
- **Sessions clear on tab close.** The JWT token is stored in `sessionStorage`. Closing the browser tab or window logs out automatically.
- **Inactive accounts** cannot log in. Deactivating an account immediately prevents access.
- **Audit trail** — all significant actions are logged and cannot be deleted through the UI.

---

## 34. Logout and Session Handling

### Logging out

Click the **sign out icon** (arrow pointing right) at the bottom of the sidebar next to your username.

You are redirected to the login page. The session token is cleared from `sessionStorage`.

### Automatic logout

- If your session token expires (30-minute JWT lifetime), the next API call returns `401 Unauthorized` and you are automatically redirected to `/login`.
- Closing the browser tab clears the token immediately (due to `sessionStorage`).

> If you are redirected to login unexpectedly in the middle of a session, log in again — your data is safe, only the session expired.

---

## 35. Troubleshooting

| Problem | Likely Cause | Solution |
|---|---|---|
| "Failed" on all actions | Authorization header missing (broken api.js) or backend not running | Check `http://localhost:5001/api/health`; verify backend is running |
| "Invalid username or password" | Wrong role selected, wrong credentials, or inactive account | Confirm the role selector matches your role; verify credentials |
| "Failed to create" on department | Not logged in as Super Admin or Admin, or token expired | Log in again as Super Admin |
| "late_reason is required" | Certificate deadline has passed | Enter a reason in the late submission text field |
| Student cannot see their OD | Student is not listed as a participant on that OD | Ask the Class Advisor or CR to verify participant list |
| Certificate upload fails with "Invalid file type" | File is not PDF, JPG, or PNG | Convert to an accepted format |
| Certificate upload fails with "exceeds 5 MB" | File is too large | Reduce file size or scan at lower resolution |
| Page shows "Unauthorized" | Your role does not have access to that page | Contact your administrator |
| Backend health shows `db: disconnected` | PostgreSQL is not running | Start PostgreSQL: `& "D:\DB\bin\pg_ctl.exe" start -D "D:\DB\data"` |
| Bulk import shows "duplicate register numbers" | Students already exist in the database | Remove duplicates from your file |
| Cannot assign advisor to class | Advisor account not created yet, or account is inactive | Create and activate the advisor account first |

---

## 36. UAT Checklist

Use this checklist to verify the system during User Acceptance Testing.

### Infrastructure

- [ ] PostgreSQL 16 is running (`pg_ctl status` reports running)
- [ ] Backend health returns `{"status":"OK","db":"connected"}`
- [ ] Frontend loads at `http://localhost:5173`
- [ ] Backend is connected to `certify_uat` (not `certificate_management`)

### Authentication

- [ ] Super Admin can log in
- [ ] Admin can log in
- [ ] Coordinating Faculty can log in
- [ ] Class Advisor can log in (after account is created)
- [ ] Class Representative can log in (after account is created)
- [ ] Student can log in (after account is created)
- [ ] Wrong password returns "Invalid username or password"
- [ ] Inactive account cannot log in

### Org Structure

- [ ] Super Admin can create a Department
- [ ] Super Admin can create an Academic Year
- [ ] Super Admin can create a Class
- [ ] Duplicate department code is rejected

### User Management

- [ ] Admin can create a Coordinating Faculty account
- [ ] Admin can create a Class Advisor account
- [ ] Admin can assign a Class Advisor to a class
- [ ] Admin can import students via bulk Excel
- [ ] Class Advisor can assign a Class Representative

### OD Registration

- [ ] Class Advisor can create an individual OD
- [ ] Class Advisor can create a team OD
- [ ] Class Representative can create an OD for their class
- [ ] Non-participant student cannot be added to an OD
- [ ] OD number is generated in `OD-YYYY-NNNNNN` format

### Certificate Workflow

- [ ] Student can upload a certificate (PDF) for an active OD
- [ ] Student cannot upload for an OD they are not a participant of
- [ ] Late submission shows the reason field
- [ ] Late certificate gets `late_submitted` status
- [ ] Advisor can approve late submission → status becomes `submitted`
- [ ] Advisor can verify a submitted certificate → status becomes `verified`
- [ ] Advisor can reject a certificate with reason → status becomes `rejected`
- [ ] Verified certificate cannot be replaced
- [ ] Unverified certificate can be replaced → version increments
- [ ] Overdue certificate is marked `overdue` on list view

### Reports

- [ ] Coordinating Faculty can generate Monthly OD Report
- [ ] Excel export downloads a valid `.xlsx` file
- [ ] ZIP download contains certificate files
- [ ] Admin can view the Audit Log
- [ ] Audit log shows department creation entry

---

## 37. Recommended Operational Sequence

For a new academic year setup:

```
WEEK 1: Foundation
  Day 1: Create departments (Super Admin)
  Day 1: Create new academic year (Super Admin)
  Day 1: Create classes for the new year (Super Admin)
  Day 2: Create/verify class advisor accounts (Admin)
  Day 2: Assign advisors to classes (Admin)
  Day 3: Bulk import students for each class (Admin / Advisor)
  Day 4: Assign class representatives (Advisor)
  Day 4: Create CR login accounts (Advisor)

WEEK 2: Operation begins
  Students log in and verify their profiles
  Class Advisors/CRs register ODs as events occur
  Students upload certificates before month-end deadline

ONGOING: Monitoring
  Coordinating Faculty reviews pending certificates weekly
  Coordinating Faculty runs monthly summary reports
  Admin monitors audit log for anomalies
  Admin promotes students at year-end via Promote Students
```

---

## 38. Role-Permission Matrix

| Feature | Super Admin | Admin | Coord. Faculty | Class Advisor | Class Rep. | Student Rep. | Student |
|---|---|---|---|---|---|---|---|
| Create Department | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Academic Year | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Class | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Admin account | Bootstrap only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Faculty account | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Advisor account | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign Advisor to Class | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Student (individual) | ✅ | ✅ | ❌ | Own class | ❌ | ❌ | ❌ |
| Bulk Import Students | ✅ | ✅ | ❌ | Own class | ❌ | ❌ | ❌ |
| Assign Class Representative | ✅ | ✅ | ❌ | Own class | ❌ | ❌ | ❌ |
| Create CR login | ✅ | ✅ | ❌ | Own class | ❌ | ❌ | ❌ |
| Create OD | ✅ | ✅ | ❌ | Own class | Own class | Any student | ❌ |
| Cancel OD | ✅ | ✅ | ✅ | Own class | ❌ | ❌ | ❌ |
| Upload Certificate | ❌ | ❌ | ❌ | ❌ | Own class | ❌ | Own ODs |
| Replace Certificate | ❌ | ❌ | ❌ | ❌ | Own class | ❌ | Own certs |
| Verify Certificate | ✅ | ✅ | ✅ | Own class | ❌ | ❌ | ❌ |
| Reject Certificate | ✅ | ✅ | ✅ | Own class | ❌ | ❌ | ❌ |
| Approve Late | ✅ | ✅ | ✅ | Own class | ❌ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ✅ | Own class | ❌ | ❌ | ❌ |
| Export Excel/ZIP | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Audit Log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Promote Students | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Academic History | ✅ | ✅ | ❌ | Own class | Own class | ❌ | ❌ |
| Permanently Delete Student | ✅ only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Deactivate Student | ✅ | ✅ | ❌ | Own class | ❌ | ❌ | ❌ |

---

## 39. End-to-End Example

This example walks through the complete lifecycle from department creation to certificate verification using a realistic scenario.

**Scenario:** CSE department, 2nd Year Section A, student Priya Sharma attends a hackathon.

---

### Step 1 — Create the Department
**Role:** Super Admin
**Navigation:** Management → Org Structure tab → Departments card
**Action:** Name = `Computer Science and Engineering`, Code = `CSE` → Create Department
**Result:** Department `CSE` created and listed.

---

### Step 2 — Create the Academic Year
**Role:** Super Admin
**Navigation:** Org Structure tab → Academic Years card
**Action:** Name = `2026-27`, Start = `2026-06-01`, End = `2027-05-31` → Create Academic Year
**Result:** Academic year `2026-27` created with Active badge.

---

### Step 3 — Create the Class
**Role:** Super Admin
**Navigation:** Org Structure tab → Classes card
**Action:** Department = `CSE`, Year = `2026-27`, Year of Study = `2nd Year`, Section = `A`, Display Name = `CSE-A` → Create Class
**Result:** Class `CSE-A` created.

---

### Step 4 — Create and Assign Class Advisor
**Role:** Admin
**Navigation:** Admin Dashboard → Coordinating Faculty tab (or Class Advisors tab)
**Action:** Create advisor account with username `advisor.cse@college.edu`
**Then:** Management → Advisors tab → Assign `advisor.cse@college.edu` to class `CSE-A · 2026-27`
**Result:** Advisor is now responsible for CSE-A.

---

### Step 5 — Import Students
**Role:** Admin or Class Advisor
**Navigation:** Management → Bulk Import tab
**Action:** Select class `CSE-A · 2026-27` → upload Excel with `register_number`, `name`, `date_of_birth` columns → Preview → Confirm
**Result:** 30 students imported; each has a login (register_number + DOB).

---

### Step 6 — Assign Class Representative
**Role:** Class Advisor
**Navigation:** Management → Representatives tab → select `CSE-A`
**Action:** Select Priya Sharma (register: `22CS001`) → Assign as CR → Create Login
**Result:** Priya Sharma can now log in as Class Representative.

---

### Step 7 — Register OD
**Role:** Class Advisor (or Class Representative)
**Navigation:** Sidebar → Register OD
**Action:**
- OD Type: Team OD
- Event Name: `National Hackathon 2026`
- Event Type: `Competition`
- Event Date: `2026-11-15`
- OD Start: `2026-11-14`
- OD End: `2026-11-16`
- Purpose: `Inter-college hackathon participation`
- Venue: `IIT Madras`
- Add participants: `22CS001 - Priya Sharma`, `22CS002 - Arjun Kumar`
- Click Create OD

**Result:** OD number `OD-2026-000001` generated. Both students are listed as participants.

---

### Step 8 — Upload Certificate
**Role:** Student (Priya Sharma)
**Login:** Register number `22CS001`, DOB as password
**Navigation:** Sidebar → Upload Certificate
**Action:**
- Select OD: `OD-2026-000001 · National Hackathon 2026`
- Upload file: `hackathon_certificate.pdf` (< 5 MB)
- (Deadline is 2026-11-30 — submission is on time)
- Click Upload Certificate

**Result:** Certificate status = `submitted`.

---

### Step 9 — Verify Certificate
**Role:** Class Advisor (`advisor.cse@college.edu`)
**Navigation:** Sidebar → Certificates → find certificate with status `submitted`
**Action:** Click certificate → click Verify
**Result:** Certificate status = `verified`. Priya Sharma can download the verified certificate.

---

### Step 10 — View Report
**Role:** Coordinating Faculty
**Navigation:** Sidebar → Reports → Monthly OD Report
**Action:** Month = `2026-11`, click Generate Report
**Result:** Report shows 1 OD record, 1 certificate submitted (Priya), 1 missing (Arjun — did not upload).
**Export:** Click Export Excel to download the report for record-keeping.

---

*End of User Manual*
