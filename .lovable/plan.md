
# VTU Internship Diary Generator

A web app where students log brief bullet points each day during their internship, and the app uses AI to expand them into formal, VTU-style diary entries. Entries can be exported as a Word document matching the standard VTU diary format.

## Core flow

**1. Sign up & set up internship profile (one-time)**
- Email/password signup (so each student keeps their own diary).
- Profile fields: full name, USN, branch/course (CSE, ISE, ECE, etc.), semester, internship title, internship type (Web Dev, ML/AI, Embedded, Cloud, Data Science, Mobile, Cybersecurity, Other), company name, mentor name, start date, end date.
- Optional: weekly learning plan (free-text outline of what topics will be covered each week) — used by AI to keep entries logically progressing.

**2. Daily entry (the main screen)**
- Calendar / list view of all internship days (weekends auto-skipped, can toggle).
- Each day shows: status (empty / drafted / finalized), date, day number.
- Click a day → enter 2–4 short bullet points of what was learned/done.
- Click "Generate" → AI expands bullets into a polished, formal diary entry (objective + work done + learning outcome), 100–200 words, using the internship profile as context.
- Edit the generated text inline before finalizing.

**3. Catch-up mode (for students who are behind)**
- Select a date range of missed days.
- Provide a short summary of the overall topics covered in that period (or pull from weekly plan).
- AI generates plausible, varied entries for every missed day at once, following a logical learning progression so they don't read as repetitive.
- Student reviews each generated entry, can regenerate or tweak individually before finalizing.

**4. Export**
- "Download diary" button generates a `.docx` file formatted to look like a typical VTU internship diary: cover page (name, USN, college, internship details), then one page per day with date, day number, and entry, plus a signature line for student/mentor.
- Optional PDF export.
- Re-export anytime as more days are filled.

## Key screens
- Login / Signup
- Internship setup (first-run wizard)
- Dashboard: calendar grid of all days with status indicators + progress bar
- Day editor: bullet input → AI-generated entry → editable preview
- Catch-up wizard: date range + topic summary → bulk-generated entries to review
- Export page: preview cover + sample pages, download .docx / .pdf
- Profile/settings: edit internship details

## Design direction
Clean, student-friendly, calm. Light theme by default with a subtle academic feel (serif headings, sans-serif body). Calendar dashboard is the centerpiece — green for finalized days, amber for drafts, gray for empty. Mobile-friendly so students can fill entries from their phone.

## Tech notes (high level)
- Auth + per-user diary storage via Lovable Cloud.
- AI text generation via Lovable AI (defaults to a fast model; entries stream in).
- `.docx` export generated on the server using the docx library.
- All AI prompts and generation happen server-side; students never see raw prompts.

## Out of scope (intentionally not auto-submitting to VTU portal)
The app generates and exports diary content — the student still pastes/uploads it into the VTU portal themselves. This keeps the tool reliable and avoids violating VTU's terms of service.
