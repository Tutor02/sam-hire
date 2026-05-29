#  Mini ATS (Applicant Tracking System)

A lightweight, AI-powered Applicant Tracking System (ATS) built for fast recruitment workflows.  
It allows companies to manage jobs, track candidates, upload CVs, and use AI to assess applicants.

Built using:
- Supabase (Backend, Auth, Database, Storage)
- Lovable (Frontend + AI workflows)

---

##  Features

### 👤 Authentication & Roles
- Email/password login
- Role-based access (Admin & Customer)
- Admin can manage all users and data
- Customers manage only their own data

---

###  Job Management
- Create and manage job postings
- View jobs in a clean dashboard
- Each job is linked to candidates

---

###  Candidate Management
- Add candidates per job
- Store candidate details:
  - Full name
  - Email
  - LinkedIn profile
  - Status (pipeline stage)
- Attach CVs to each candidate

---

### 📄 CV Upload System
- Upload CVs (PDF/DOCX)
- Files stored securely in Supabase Storage
- Download/View CV anytime

---

###  Kanban Pipeline
Visual recruitment workflow:
- Applied
- Screening
- Interview
- Offer
- Hired
- Rejected

Features:
- Drag and drop candidates between stages
- Filter by job or candidate name

---

###  AI Candidate Assessment
Each uploaded CV can be analyzed using AI to generate:

- Candidate score (0–100)
- Summary of experience
- Key strengths
- Potential risks
- Hiring recommendation

This helps recruiters quickly shortlist candidates.

---

##  Tech Stack

- **Frontend:** Lovable
- **Backend:** Supabase
- **Database:** PostgreSQL (via Supabase)
- **Auth:** Supabase Authentication
- **Storage:** Supabase Storage
- **AI:** LLM-based CV analysis via Lovable workflows

---

##  Database Structure

### Tables

#### profiles
- id
- full_name
- role (admin / customer)

#### jobs
- id
- user_id
- title
- description

#### candidates
- id
- user_id
- job_id
- full_name
- email
- linkedin
- status
- cv_url
- ai_score
- ai_summary
- ai_strengths
- ai_risks

---

##  Security

- Row Level Security (RLS) enforced
- Users can only access their own data
- Admins have full system access
- Secure file storage with Supabase policies

---

##  AI Workflow

1. Upload CV
2. Extract text from document
3. Send text to AI model
4. Generate structured output:
   - Score
   - Summary
   - Strengths
   - Risks
   - Recommendation
5. Store results in database
6. Display in Kanban UI

---

##  Setup Instructions

### 1. Clone repo
```bash
git clone https://github.com/tutor02/mini-ats.git
