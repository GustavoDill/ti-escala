# Agent Rules & Project Governance (`ti-escala`)

All AI agents working on this repository **MUST** strictly follow these rules in every session.

---

## 1. Mandatory Plan-Before-Implementation Workflow

1. **Never write implementation code without an approved plan.**
   - Before starting any new feature, architectural change, or bug fix, review [`PLAN.md`](./PLAN.md) and [`TASKS.md`](./TASKS.md).
   - If a task is `Not started`, first design its implementation details, update [`PLAN.md`](./PLAN.md) if needed, and transition the task status in [`TASKS.md`](./TASKS.md) to `Planned`.
   - Ask clarifying questions whenever requirements or edge cases are ambiguous before writing code.
2. **Follow task order and dependencies.**
   - Only move a task in [`TASKS.md`](./TASKS.md) to `Working on` when actively implementing it.
   - Move a task to `Done` only after verifying that all requirements in its `Requirements` column are satisfied and tested.

---

## 2. Session Recording & Resumability (`sessions/`)

Every agent session **MUST** be recorded in a markdown file inside the [`sessions/`](./sessions/) directory so future agents or developers can resume seamlessly.

### Naming Convention
- `sessions/YYYY-MM-DD_session-NN.md` (e.g., `sessions/2026-11-10_session-01.md`).

### Required Sections in Every Session File
1. **Session Metadata**: Date, Agent/Model, Active Task IDs from `TASKS.md`, Session Goal.
2. **Summary of Work Done**: Decisions made, files created/modified, endpoints or components touched.
3. **Current State & Verification**: What works, what was tested, and any uncommitted or pending items.
4. **Open Questions / Blockers**: Pending user decisions or environment dependencies.
5. **Next Steps for Resuming Agent**: Clear, ordered instructions for the next session to pick up immediately.

### Session Startup Checklist
At the beginning of **every** session, the agent must:
1. Read [`AGENTS.md`](./AGENTS.md).
2. Read the latest file in [`sessions/`](./sessions/) to restore context.
3. Check [`TASKS.md`](./TASKS.md) and [`PLAN.md`](./PLAN.md).

---

## 3. Task Management (`TASKS.md`)

[`TASKS.md`](./TASKS.md) is the single source of truth for project progress and must be maintained in a Markdown table (grid structure) with the following columns:

| Column | Description |
| :--- | :--- |
| `TASK-ID` | Unique identifier (e.g., `TASK-001`, `TASK-002`) |
| `Category` | Subsystem (`Gov`, `Backend`, `Supabase`, `Auth`, `Frontend`, `Export`, `DevOps`) |
| `Description` | Concise summary of the deliverable |
| `Status` | Strictly one of: `Not started`, `Planned`, `Working on`, `Done` |
| `Requirements` | Specific acceptance criteria and technical constraints |
| `Dependencies` | Prerequisite `TASK-ID`s (or `None`) |

---

## 4. Technical & Architectural Constraints

1. **Clean-Room Implementation**:
   - Do **NOT** copy any code from the legacy `escala-calendar` project (`https://escala-calendar.onrender.com`).
   - Visual concepts and domain workflows may serve as inspiration, but all architecture, UI components, styles, and backend logic must be newly authored.
2. **Tech Stack**:
   - **Runtime & Backend**: Node.js with **Hono** (TypeScript).
   - **Deployment**: Dockerized container ready for **Render** deployment.
   - **Storage & Sync**:
     - `escala.csv` is stored in a **Supabase Storage Bucket** (initially uploaded manually by the administrator; no local seed `escala.csv` is bundled in the repository or Docker container).
     - On application startup, the server downloads the latest `escala.csv` from Supabase Storage and caches it locally (memory + ephemeral runtime disk cache in `/tmp` or `./.cache/escala.csv` that only exists while the Render instance is running).
     - If `escala.csv` is not present in the Supabase bucket on startup, the server must display an error and abort its main functionality.
     - Any data modification in Edit Mode updates the ephemeral runtime cache and immediately pushes the updated `escala.csv` to the Supabase Storage Bucket.
3. **Authentication & Authorization**:
   - Default mode is **Read-Only** for all visitors.
   - Entering **Edit Mode** and calling mutation endpoints require authentication via either the `administrator` (Boss/Manager) or `system` (Developer) role password.
   - Passwords are stored in Supabase Postgres (`public` schema) hashed with **SHA-512**.
   - In case of a lost password, a DB admin can manually update the hash in Supabase using SHA-512.
4. **CSV Format Compatibility**:
   - Preserve compatibility with the Excel-exported semicolon-delimited (`;`) CSV format (`MATRICULA;Nome;SETOR;FUNÇÃO;SABADO;DOMINGO;ESCALA;ENTR;INI INTER;RET INTER;ESCALA; SAI;TOTAL INTERVALO;TOTAL LOGADO;<DD/MM/YYYY>...`).
   - Handle UTF-8 and Windows-1252 / Latin-1 character encodings cleanly so Portuguese accents (`MANHÃ`, `NEGÓCIOS`, `FUNÇÃO`, `FÉRIAS`) are never corrupted.

