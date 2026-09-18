# Documentation — Certificate Management System v1.3

This folder contains the complete technical and project documentation for the Certificate Management System.

---

## Documents

### [API.md](./API.md)
Full REST API reference.

Covers every endpoint grouped by route category: authentication, user management, students, OD records, certificates, reports, and the health check. Each entry includes the HTTP method and path, required authentication, allowed roles, request format (body fields or query parameters), response shape with example JSON, and documented error cases with HTTP status codes.

Use this when:
- Integrating a new frontend component with a backend endpoint.
- Debugging unexpected API responses.
- Adding a new route and needing to understand existing conventions.

---

### [DATABASE.md](./DATABASE.md)
Complete database schema documentation.

Covers all four tables (`students`, `users`, `od_records`, `certificates`) and the `registration_number_seq` sequence. Each table entry lists every column with its data type, constraints, and description. Also documents all indexes, foreign key relationships, the entity-relationship diagram, the constraints summary, and migration instructions.

Use this when:
- Writing or reviewing SQL migrations.
- Understanding how tables relate to each other.
- Tracing a bug that involves unexpected data in the database.
- Planning a schema change.

---

### [DESIGN.md](./DESIGN.md)
Architecture and design decisions.

Documents the key design choices made during development: registration number format and sequence strategy, the internal `student_id` versus the institutional `register_number`, the role hierarchy, file storage layout, and monthly reporting approach. Also lists pending department decisions (authentication method, OD blocking policy, cancellation authority, late submission, department scope, edit authority), confirmed requirements, and features explicitly excluded from scope.

Use this when:
- Understanding why something was built a certain way before changing it.
- Evaluating whether a proposed feature is in scope.
- Onboarding a new team member to the project architecture.

---

### [PROJECT_SUBMISSION.md](./PROJECT_SUBMISSION.md)
Official project submission document.

A self-contained summary of the complete project written for submission. Covers the executive summary, objectives, technology stack, layered architecture, all four role workflows step by step, database design across all three migrations, API route group summary, security and validation measures, local setup instructions, test credentials, and end-to-end validation evidence.

Use this when:
- Submitting or presenting the project to faculty or reviewers.
- Producing a high-level overview without reading the full technical docs.

---

## How the documents relate

```
PROJECT_SUBMISSION.md   ← High-level overview of everything (start here)
        │
        ├── API.md          ← Detailed endpoint reference
        ├── DATABASE.md     ← Detailed schema reference
        └── DESIGN.md       ← Architecture decisions and constraints
```

For setup and running the application locally, see the [root README](../README.md), [backend README](../backend/README.md), and [frontend README](../frontend/README.md).

---

## Document Versions

All documents reflect **v1.3** of the Certificate Management System, validated on **18 September 2026** against a live local PostgreSQL 18 instance with all three migrations applied.
