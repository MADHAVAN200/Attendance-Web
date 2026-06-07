# Mano Workforce Intelligence Platform

Mano is a high-density workforce monitoring, attendance tracking, and administrative intelligence platform designed for enterprise-grade team management, daily activity reporting, and organizational collaboration.

## Core Modules and Features

### 1. High-Density Industrial UI (Obsidian Theme)
- Specialized global scaling architecture leveraging an 80% equivalent zoom-level layout. Uses a base font-size of 13px to maximize screen real estate and data visibility without compromising legibility.
- Professional dark mode design optimized for low fatigue during extended administrative monitoring.
- High-density grids, data tables, and calendars that scale dynamically depending on viewport dimensions.

### 2. User Authentication and Tenant Isolation
- Secure session management utilizing JSON Web Tokens (JWT) with HttpOnly cookie support and role-based access control.
- Clear separation of access levels for super administrators, organization administrators, HR personnel, and general employees.
- Complete multi-tenant data sovereignty, ensuring that all policies, logs, and employee details are isolated at the organization level.

### 3. Executive Dashboard
- Interactive summaries displaying active workforce metrics, current shift coverage, daily activity, and checked-in personnel rates.
- Graphical trend charts tracking weekly check-in counts, shift timings compliance, and department distributions.
- Real-time feed highlighting check-in locations, check-out events, and pending administrative requests.

### 4. Attendance Tracking and Live Monitoring
- Real-time administrative monitor displaying check-in times, check-out times, and calculated late check-in or early leave durations.
- Automated compliance alerts flags for out-of-boundary check-ins and unauthorized device identifiers.
- Self-service employee portals for location-validated check-in and check-out.
- Correction request system enabling employees to propose adjustments for missing logs, with full administrative approval workflows.

### 5. Shift Management and Geofencing
- Dynamic creation and assignment of work shifts with configurable start times, end times, grace periods, and late-arrival limits.
- Precise geofencing controls allowing administrators to designate valid check-in coordinates and set search radius thresholds in meters.
- Multi-location bindings to assign employees to specific branch offices or external job sites.

### 6. Daily Activity Reports (DAR)
- Individual work logs where employees record tasks, meetings, project tags, and hours spent on each activity.
- Daily reporting feeds detailing employee daily entries.
- RAG-powered automated analysis scanning activity logs to identify productivity bottlenecks, check-in anomalies, and provide feedback.

### 7. Holidays and Leave Management
- Multi-category leave request system supporting medical leaves, casual leaves, and earned leaves.
- Visual leave tracker displaying team-wide calendar details of upcoming organization holidays and approved absences.
- Automated balance calculations tracking remaining leave allowances for each employee profile.

### 8. Chat and Collaboration Hub
- **Real-Time Direct & Group Messaging**: Seamless 1-on-1 direct messages and multi-user group channels powered by a high-throughput Socket.io websocket pipeline.
- **Encrypted History Storage**: Secure database storage of chat message archives with automatic decryption on retrieval, ensuring complete data privacy.
- **Removed Member History Retention**: Users removed from a group channel can no longer send messages or view newly posted content, but securely retain read-only access to historical group logs up to their exact removal timestamp.
- **Teammate @Mentions & Auto-Complete**: Dynamic member search popup triggered by typing `@`, enabling rapid auto-complete tagging. Mentions render as formatted blue links and trigger priority system & push notifications for target users.
- **Real-Time Typing Indicators**: Visual "typing..." status updates on the sidebar and chat header, managed with websocket events, auto-timeout protection, and instant clear on send.
- **Pin Conversations**: Pin important group channels or direct messages to the top of the sidebar list for quick access, persisted locally per user profile.
- **Conversation Search & Filtering**: Comprehensive search input in the sidebar to filter chat rooms by channel name or message preview text.
- **Unread Message Badges**: Dynamic notifications badges counting new unread incoming messages for all background chat channels.
- **Participant Color-Coding**: Unique deterministic color schemes assigned to users, initials, and backgrounds to easily identify who is speaking in crowded group channels.
- **File and Attachment Sharing**: Secure document, pdf, and image uploads up to 50MB using Amazon S3 or compatible storage integrations.

### 9. Super-Admin Panel
- Global overview console tracking organization tenants, active user counts, and system metrics.
- Server health dashboard exposing real-time logs, network request latency, database query counts, and connection pools.
- Security alert feed monitoring rate-limit violations, token expirations, and administrative modifications.

### 10. Recruitment & Careers Portal
- **Public Careers Page**: Dedicated landing pages for active job listings (`/careers/:slug`) allowing applicants to view job details and apply.
- **Interactive Dashboard**: Full applicant tracking workspace with tabs for active Job Openings, Career Opening Creation, Recruitment Pipeline stages, and AI Candidate Rankings.
- **AI JD Generator**: Simulated intelligent assistant enabling administrators to generate complete role structures, skills, and benefits using brief descriptive inputs.
- **AI Resume Parsing & Ranking**: Simulated scoring engine parsing uploaded PDF resumes to evaluate Skill Match, Experience, Education, and Culture Fit, highlighting candidate strengths, weaknesses, and recommendation labels.

### 11. HR Document Studio
- **Template Catalog**: Ready-to-use document generation templates for Appointment/Offer Letters, Performance Appraisals, Employment Agreements, and Company Policies.
- **Employee Master Integration**: Autocomplete feature to quick-populate employee profile information, designation, and salaries.
- **Dynamic Salary Annexure**: Automated calculations dividing CTC into Basic (40%), HRA (50% of Basic), PF (12% of Basic), and Special Allowance, outputting a clear monthly and annualized matrix.
- **Print-Ready Layouts**: Tailwind/CSS styling optimized for print-only media, formatting documents onto professional company letterheads with reference codes, digital signatures, and headers.

### 12. Subscription Management & Billing
- **Multi-Tier Plan Matrix**: Three feature plans (Basic, Professional, and Enterprise) billed on a scalable per-user basis.
- **Scalable Seat Slider**: User range selector mapping team sizes from 1 to 1000+ seats, dynamically adjusting price estimates.
- **Billing Cycle Toggle**: Supports monthly or yearly billing intervals, offering an automatic 20% discount on annual commitments.
- **Unified Payment Gateway**: Direct integration with the Razorpay checkout SDK, verified securely via backend APIs for transaction signature verification.
### 13. AI Chatbot & RAG Intelligence
- **Public Website RAG Widget**: Pre-login chat widget on the landing page powered by the Groq Llama 3.3 model and Xenova embedding pipeline (`all-MiniLM-L6-v2`) querying a ChromaDB collection (with local JSON chunk fallback).
- **Mano Copilot (Internal Assistant)**: Authenticated app guide powered by Groq, utilizing keyword matching and semantic searches over `internalAppGuide.json` to guide active users based on their current page path and user role.

### 14. Employee Master & Onboarding
- **Comprehensive Profiles**: Centralized directory listing employee codes, phone numbers, departments, designations, joining dates, and active status.
- **Onboarding Checklist Tracker**: Dynamic task checklist (Docs Submitted, Offer Accepted, Contract Signed, Laptop Assigned, Email Created, Training Assigned, Manager Assigned) calculating onboarding progress percentages in real-time.
- **Digital Document Lockers**: Structured folders for uploading and managing Identity (Aadhaar, PAN, Passport, License), Educational (SSC, HSC, Degree marksheets), Employment (Offers, relieving letters, payslips), Banking (cancelled cheques, statements), and Compliance (PF, UAN, ESIC) files.
- **AI Document Auditor**: Automated scanner evaluating missing required documents, checking expiration dates, and verifying matching names (Name on Document vs. employee directory profile) to flag discrepancies.
- **Performance Cycle Integration**: Dedicated tabs linking employee records to active performance evaluation cycles, managing KPI goal sheets, reviews, ratings, and running AI feedback reviews.

---

## Technical Stack

### Frontend (React Ecosystem)
- Build Tool: Vite
- Structure: React 18, React Router DOM
- Styling: Tailwind CSS (with custom utility layers for high-density components)
- Animation: Framer Motion (micro-interactions and modal transitions)
- Charts: Recharts
- Icons: Lucide React

### Backend (Node.js API)
- Framework: Express 5.x
- Database Queries: Knex.js
- Caching Layer: Redis
- Real-Time Communication: Socket.io
- Security Protocols: Helmet, Express Rate Limit, JWT-based Sessions

### Intelligence Layer
- Vector Search: ChromaDB
- LLM Engines: Groq Cloud SDK, Xenova Transformers
- Export Generators: ExcelJS, PDFMake

---

## Database Architecture
The platform is designed around a relational database architecture managed via Knex.js.
- Table chat_rooms contains fields for room_id, org_id, room_name, room_type (direct or group), created_by, member_ids (JSON array of user IDs), messages (encrypted JSON array of message objects), last_read_times (JSON mapping user_id to read timestamps), and removed_members (JSON mapping user_id to their removal details and timestamps).

---

## Getting Started

### Prerequisites
- Node.js version 20.19+ or 22.12+
- Redis Server (local or cloud instance)
- MySQL / PostgreSQL / SQLite database

### Installation
1. Clone the repository and navigate to the project root.
2. Install root dependencies:
   ```bash
   npm install
   ```
3. Navigate to the backend directory, duplicate the environment template, and configure your keys:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   ```
4. Navigate to the frontend directory and install dependencies:
   ```bash
   cd ../frontend
   npm install
   ```

### Running Locally
To launch both the backend server and the Vite frontend dev server concurrently, run the following command from the project root:
```bash
npm start
```
- Backend server runs on http://localhost:5002
- Frontend dev server runs on https://localhost:5173
