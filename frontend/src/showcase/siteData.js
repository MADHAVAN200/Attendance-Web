export const navigation = {
    product: [
        { label: "Overview", path: "/product/overview" },
        { label: "Attendance Tracking", path: "/product/attendance-tracking" },
        { label: "Leave Management", path: "/product/leave-management" },
        { label: "Workforce Analytics", path: "/product/workforce-analytics" },
        { label: "Policy & Geofencing", path: "/product/policy-geofencing" },
        { label: "Reports & Automation", path: "/product/reports-automation" },
    ],
    solutions: [
        { label: "For HR Teams", path: "/solutions/hr-teams" },
        { label: "For Managers", path: "/solutions/managers" },
        { label: "For Enterprises", path: "/solutions/enterprises" },
        { label: "For Remote Teams", path: "/solutions/remote-teams" },
    ],
    features: [
        { label: "Admin Dashboard", path: "/features/admin-dashboard" },
        { label: "Employee Management", path: "/features/employee-management" },
        { label: "Smart Attendance", path: "/features/smart-attendance" },
        { label: "Live Attendance", path: "/features/live-attendance" },
        { label: "Comprehensive Reports", path: "/features/comprehensive-reports" },
        { label: "Daily Activity Report", path: "/features/daily-activity-reports" },
        { label: "Geo Fencing", path: "/features/geo-fencing" },
        { label: "Policy Engine", path: "/features/policy-engine" },
        { label: "Holidays & Leave", path: "/features/holidays-leave" },
    ],
    ai: [
        { label: "\"Ask HR\" AI Assistant", path: "/ai/ask-hr-assistant" },
        { label: "Smart DAR Insights", path: "/ai/smart-dar-insights" },
        { label: "Generative Policy Builder", path: "/ai/generative-policy-builder" },
    ],
    resources: [
        { label: "Documentation", path: "/resources/documentation" },
        { label: "Blog", path: "/resources/blog" },
        { label: "FAQs", path: "/resources/faqs" },
    ],
    company: [
        { label: "About", path: "/company/about" },
        { label: "Contact", path: "/company/contact" },
    ],
};

export const homeData = {
    heroImage: "/showcase/dashboard.png",
    headline: "Smart Attendance & Workforce Management for Modern Teams",
    subtext:
        "MANO-Attendance helps organizations track employee attendance, manage leave requests, enforce location-based compliance, and generate powerful workforce insights -- all in one intelligent platform.",
    ctaPrimary: "Start Free Trial",
    ctaSecondary: "Book a Demo",
    values: [
        "Ask natural language questions to the AI-powered HR Assistant",
        "Generate dynamic shift policies instantly with Prompts",
        "Prevent proxy attendance with webcam verification",
        "Ensure employees are present at the right location with geofencing",
        "Automate leave, attendance corrections, and HR approvals",
    ],
    highlights: [
        {
            title: "Simple Time In & Time Out",
            body: "Effortlessly track employee attendance with our intuitive time clock. One-click time logging designed for speed and accuracy, ensuring every work hour is accounted for without administrative friction.",
            bullets: [
                "One-click clock-in and clock-out from web or mobile",
                "Automated shift recognition and late-mark calculation",
                "Secure session handling with biometric/identity verification",
                "Instant sync to manager dashboards for real-time visibility"
            ],
            image: "/showcase/mobile.png",
            link: "/product/attendance-tracking"
        },
        {
            title: "Live Command Center",
            body: "Monitor your organization's heartbeat in real-time. Watch employee sessions pulse as they clock in globally, mapped against authorized geofences with sub-meter accuracy.",
            bullets: [
                "Live Pulsing Session indicators for active workers",
                "Real-time GPS Coordinate mapping and movement tracking",
                "Immediate Geofence Breach and Exception flagging",
                "Emergency Broadcasts and Coordination Hub"
            ],
            image: "/showcase/live-attendance.png",
            link: "/features/live-attendance"
        },
        {
            title: "Detailed Attendance & Matrix Reports",
            body: "Gain deep visibility into workforce patterns with structured reporting. From high-level monthly summaries to granular daily logs, our matrix reports translate raw punches into actionable payroll data.",
            bullets: [
                "Daily, Weekly, and Monthly Attendance Matrix views",
                "Automated Lateness & Overtime calculation reports",
                "Detailed Attendance Logs (Original) with GPS/Biometric proof",
                "One-click Export to Excel and PDF for payroll processing"
            ],
            image: "/showcase/reports.png",
            link: "/features/comprehensive-reports"
        },
        {
            title: "Holiday & Leave Management",
            body: "Simplify time-off requests with a unified leave governance system. Manage holiday calendars, track accruals, and automate approval workflows to keep your workforce balanced and compliant.",
            bullets: [
                "Self-service Leave Applications for all employees",
                "Multi-level Approval Workflows with instant notifications",
                "Public Holiday Calendar and regional shift mapping",
                "Real-time Leave Balance & Accrual tracking"
            ],
            image: "/showcase/dashboard.png",
            link: "/product/leave-management"
        },
        {
            title: "\"Ask HR\" AI Assistant",
            body: "A conversational AI chatbot trained on your company's policy documents. Employees get instant, cited answers rather than generating HR tickets. It acts as a 24/7 first-response layer for all internal queries.",
            bullets: [
                "Natural Language Processing (NLP) for complex policy queries",
                "Live Document Citations with direct links to Handbook sections",
                "Personalized Leave Balance & Application Status checking",
                "Automated FAQ handling to reduce HR administrative load"
            ],
            image: "/showcase/rag-assistant.png",
            link: "/ai/ask-hr-assistant"
        },
        {
            title: "Generative Policy Builder",
            body: "Create complex attendance policies in seconds using natural language prompts. Our Generative AI translates your business intent into structured backend logic and geofencing rules instantly.",
            bullets: [
                "Prompt-to-Form Auto Population for rapid policy drafting",
                "Complex Shift Rotation and Grace Period logic generation",
                "Automated Legal Compliance & Guardrail checks",
                "Instant Terms & Conditions (T&C) document generation"
            ],
            image: "/showcase/policy-builder.png",
            link: "/ai/generative-policy-builder"
        },
        {
            title: "Smart DAR Insights",
            body: "Bridge the gap between raw logs and actionable productivity. While basic DAR tracks tasks and hours, our AI-driven insights synthesize team themes and detect operational bottlenecks automatically.",
            bullets: [
                "Basic DAR: Structured daily activity logging and supervisor review",
                "AI DAR: Automated Weekly Theme Synthesizing and Productivity Scoring",
                "Proactive Vague Entry Detection and auto-follow-up prompts",
                "Sentiment Analysis for team morale and burnout indicators"
            ],
            image: "/showcase/dar.png",
            link: "/ai/smart-dar-insights"
        },
        {
            title: "Advanced Geofencing",
            body: "Ensure employees are physically present at approved work locations using intelligent geofencing. Support for multi-site deployments with dynamic boundary enforcement.",
            bullets: [
                "Full Google Maps API Integration for precise location drawing",
                "Set allowed zones and radiuses (e.g., 100 meters)",
                "Dynamic Site Switching for field-based and roving teams",
                "Client-Site Authorization via biometric & location binding"
            ],
            image: "/showcase/geo-fencing-new.png",
            link: "/features/geo-fencing"
        }
    ],
    impactStats: [
        {
            title: "Approval Turnaround",
            value: "Up to 40% Faster",
            note: "Leave and correction approvals move faster with structured workflows and role routing.",
            icon: "TimerReset"
        },
        {
            title: "Operational Visibility",
            value: "Single Source View",
            note: "HR, managers, and leadership access one consistent attendance and policy view.",
            icon: "Activity"
        },
        {
            title: "Payroll Readiness",
            value: "Same-Day Exports",
            note: "Attendance summaries and compliance-ready exports reduce month-end bottlenecks.",
            icon: "Table2"
        },
        {
            title: "Proxy Attendance",
            value: "99.9% Reduction",
            note: "Facial verification and geospatial locking effectively eliminate buddy punching.",
            icon: "ShieldCheck"
        },
        {
            title: "Compliance Violations",
            value: "Zero-Penalty Goal",
            note: "The autonomous policy engine ensures total adherence to complex labor laws.",
            icon: "Scale"
        },
        {
            title: "Employee Satisfaction",
            value: "+25% Engagement",
            note: "Transparent leave balances and clear policies reduce workforce frustration.",
            icon: "HeartHandshake"
        },
    ],
    workflowSteps: [
        {
            title: "Onboard & Configure",
            body: "Setup custom geofences, define complex shift rules, and import your entire employee hierarchy.",
            icon: "Settings2"
        },
        {
            title: "Capture Attendance",
            body: "Employees clock in globally via mobile or web with facial recognition and strict GPS validation.",
            icon: "MapPin"
        },
        {
            title: "Apply Policies Autonomously",
            body: "The AI engine instantly calculates grace periods, overtime, and optimal shift alignments.",
            icon: "Cpu"
        },
        {
            title: "Manage Exceptions",
            body: "Managers are immediately notified of anomalies and can process corrections with a single click.",
            icon: "ShieldAlert"
        },
        {
            title: "Generate Smart Insights",
            body: "Daily Activity Reports (DAR) and LLMs summarize weekly productivity and highlight chronic lateness.",
            icon: "BrainCircuit"
        },
        {
            title: "Export to Payroll",
            body: "One-click export of structured, compliance-ready data directly to finance teams at month-end.",
            icon: "ArrowRightLeft"
        },
    ],
    trusted:
        "Used by growing teams across operations, technology, consulting, and field services.",
};

export const pageContent = {
    "/product/overview": {
        title: "Product Overview",
        image: "/showcase/dashboard.png",
        intro:
            "MANO-Attendance is a comprehensive attendance and HR management platform designed to simplify workforce tracking and improve operational transparency.",
        body:
            "The system enables organizations to accurately record employee attendance, automate leave workflows, enforce location compliance, and generate insightful workforce reports.",
        points: [
            "Attendance Tracking",
            "Leave Management",
            "Policy Engine",
            "Workforce Analytics",
            "Real-time Notifications",
        ],
    },
    "/product/attendance-tracking": {
        title: "Attendance Tracking",
        image: "/showcase/mobile.png",
        intro:
            "Employees can securely record their working hours using time-in and time-out functionality supported by webcam verification and GPS location tracking.",
        body: "Smart time logging helps HR and managers reduce errors and maintain reliable attendance records.",
        sections: [
            {
                title: "Smart Time Logging",
                body:
                    "Employees can securely record their working hours using time-in and time-out functionality supported by webcam verification and GPS location tracking.",
                label: "Key Capabilities",
                bullets: [
                    "Photo-based attendance capture",
                    "Location validation with geofencing",
                    "Automatic late detection",
                    "Timezone-aware attendance logs",
                ],
            },
        ],
        points: [
            "Photo-based attendance capture",
            "Location validation with geofencing",
            "Automatic late detection",
            "Timezone-aware attendance logs",
        ],
    },
    "/product/leave-management": {
        title: "Leave & Holiday Management",
        image: "/showcase/dashboard.png",
        intro:
            "Employees can easily submit leave requests while administrators maintain full visibility and control.",
        body: "Built workflows keep approvals fast, transparent, and policy compliant.",
        sections: [
            {
                title: "Leave Management",
                body:
                    "Employees can easily submit leave requests while administrators maintain full visibility and control.",
                label: "Capabilities",
                bullets: [
                    "Multiple leave types (CL, SL, EL, WFH)",
                    "Leave balance tracking",
                    "Holiday calendar management",
                    "Approval workflows",
                ],
            },
        ],
        points: [
            "Multiple leave types (CL, SL, EL, WFH)",
            "Leave balance tracking",
            "Holiday calendar management",
            "Approval workflows",
        ],
    },
    "/product/workforce-analytics": {
        title: "Workforce Analytics",
        image: "/showcase/analytics.png",
        intro:
            "The admin dashboard provides real-time insights into workforce attendance and operational trends.",
        body: "Charts are powered by Recharts and Chart.js for visual and actionable intelligence.",
        sections: [
            {
                title: "Workforce Analytics",
                body:
                    "The admin dashboard provides real-time insights into workforce attendance and operational trends.",
                label: "Metrics Available",
                bullets: [
                    "Present / Absent employees",
                    "Late arrivals",
                    "Overtime tracking",
                    "Attendance trends",
                ],
                note: "Charts are powered by Recharts and Chart.js.",
            },
        ],
        points: [
            "Present / Absent employees",
            "Late arrivals",
            "Overtime tracking",
            "Attendance trends",
        ],
    },
    "/product/policy-geofencing": {
        title: "Policy Engine & Geofencing",
        image: "/showcase/geofence.png",
        intro:
            "MANO-Attendance ensures employees are physically present at approved work locations using intelligent geofencing technology.",
        body: "HR teams can dynamically configure attendance and compliance rules at organization level.",
        points: [
            "Office location radius enforcement",
            "Client-site geofencing",
            "GPS coordinate verification",
            "Location address resolution via Google Maps",
            "Work shifts and late thresholds",
            "Biometric/photo requirements and location restrictions",
        ],
    },
    "/product/reports-automation": {
        title: "Reports & Automation",
        image: "/showcase/analytics.png",
        intro:
            "MANO-Attendance enables organizations to generate detailed workforce reports for HR, payroll, and compliance purposes.",
        body: "Automations reduce manual processing and improve reporting accuracy.",
        sections: [
            {
                title: "Reports & Automations",
                body:
                    "MANO-Attendance enables organizations to generate detailed workforce reports for HR, payroll, and compliance purposes.",
                label: "Export Formats",
                bullets: ["Excel (.xlsx)", "PDF reports"],
            },
            {
                title: "Report Data Includes",
                bullets: [
                    "Daily attendance logs",
                    "Working hours summary",
                    "Late minutes",
                    "Location details",
                ],
            },
        ],
        points: [
            "Excel (.xlsx) export",
            "PDF reports",
            "Daily attendance logs",
            "Working hours summary",
            "Late minutes and location details",
        ],
    },
    "/solutions/hr-teams": {
        title: "Solutions For HR Teams",
        image: "/showcase/dashboard.png",
        intro: "A centralized platform for policy control, leave governance, and organization-wide attendance compliance.",
        body: "Reduce operational overhead with automated approvals, notifications, and reporting pipelines.",
        points: ["Policy configuration", "Approval workflows", "Payroll-ready reports", "Compliance visibility"],
    },
    "/solutions/managers": {
        title: "Solutions For Managers",
        image: "/showcase/analytics.png",
        intro: "Get real-time team attendance visibility and exception handling tools in one dashboard.",
        body: "Approve corrections and leave quickly while monitoring trends across teams and shifts.",
        points: ["Daily team snapshot", "Correction approvals", "Late/absence alerts", "Productivity trends"],
    },
    "/solutions/enterprises": {
        title: "Solutions For Enterprises",
        image: "/showcase/dashboard.png",
        intro: "Scale attendance operations across departments, offices, and field teams with a secure architecture.",
        body: "Designed for high-volume workflows, role-based controls, and enterprise-grade security.",
        points: ["Role-based access", "Scalable reporting", "Security controls", "Multi-location governance"],
    },
    "/solutions/remote-teams": {
        title: "Solutions For Remote Teams",
        image: "/showcase/mobile.png",
        intro: "Maintain accountability and trust for distributed teams using verification, geolocation, and activity reporting.",
        body: "Create clarity for remote attendance without compromising flexibility.",
        points: ["Remote clock-in verification", "Geo-aware policies", "Work log consistency", "Automated alerts"],
    },
    "/features/smart-attendance": {
        title: "Smart Attendance",
        image: "/showcase/smart-attendance.png",
        intro: "Intelligent time tracking for in-office, field, and hybrid teams.",
        body: "Capture high-quality data from every shift and improve compliance with configurable policies.",
        sections: [
            {
                title: "Configurable Rule Engine",
                body: "Every organization operates differently. HR teams can configure organizational attendance rules dynamically to fit exact operational needs.",
                label: "How It Works",
                bullets: [
                    "Define custom work shifts and grace periods",
                    "Set progressive late thresholds with warnings",
                    "Enforce biometric or photo requirements per location",
                ],
                note: "Rule sets can be tuned by team, location, or business function for better policy fit.",
            },
            {
                title: "Hybrid Workforce Tracking",
                body: "Whether employees are at their desks, on a client site, or working from home, the system adapts to capture accurate timestamps.",
                label: "Capabilities",
                bullets: [
                    "Timezone-aware logging for distributed teams",
                    "Automated shift alignment to prevent overlaps",
                    "Break window handling to comply with labor laws",
                ],
            },
            {
                title: "Managerial Summaries",
                body: "Raw data is automatically processed into easy-to-read compliance summaries at the end of each shift.",
                label: "The Value",
                bullets: [
                    "Daily compliance flags for exceptions",
                    "Overtime probability scoring",
                    "Actionable dashboards for direct managers",
                ],
            },
        ],
        points: ["Time-in / Time-out", "Late detection", "Timezone support", "Shift alignment", "Break handling", "Daily summaries"],
    },
    "/features/face-camera-verification": {
        title: "Face & Camera Verification",
        image: "/showcase/mobile.png",
        intro: "Prevent proxy attendance through high-confidence photo-based verification workflows.",
        body: "Webcam-assisted attendance strengthens trust and auditability in your workforce data, ensuring the right person is clocking in.",
        sections: [
            {
                title: "Anti-Proxy Capture",
                body: "At the moment of clock-in, the system requires a live photo capture from the user's device camera, acting as a powerful deterrent against buddy punching.",
                label: "How It Works",
                bullets: [
                    "Requires live webcam/mobile camera access",
                    "Captures high-resolution timestamped photos",
                    "Links photo evidence directly to the attendance log",
                ],
            },
            {
                title: "Audit-Ready Records",
                body: "In the event of a dispute or compliance audit, HR and managers have immediate access to visual proof of attendance.",
                label: "The Value",
                bullets: [
                    "Immutable audit trails tied to identity",
                    "Simplifies dispute resolution for managers",
                    "Increases overall operational integrity",
                ],
            },
        ],
        points: ["Live photo capture", "Proxy deterrent", "Audit-ready logs", "Timestamp validation", "Dispute resolution"],
    },
    "/features/geofencing-location-tracking": {
        title: "Geofencing & Location Tracking",
        image: "/showcase/geofence.png",
        intro: "Track attendance against approved office and client-site radiuses.",
        body: "Location intelligence helps ensure attendance is authentic, policy-compliant, and geographically accurate.",
        sections: [
            {
                title: "Intelligent Boundaries",
                body: "Administrators can draw virtual fences around office buildings, job sites, or remote locations.",
                label: "How It Works",
                bullets: [
                    "Set allowed radius zones (e.g., 100 meters)",
                    "Validates live GPS coordinates at clock-in",
                    "Translates raw coordinates into readable addresses via Google Maps",
                ],
            },
            {
                title: "Site-Level Controls",
                body: "Different teams need different rules. Enforce strict geofencing for HQ staff while allowing city-wide radiuses for field sales.",
                label: "Capabilities",
                bullets: [
                    "Multi-location deployment support",
                    "Dynamic policy assignment per site",
                    "Flags 'Out of Bounds' attendance immediately",
                ],
            },
        ],
        points: ["Geofence boundaries", "GPS validation", "Address resolution", "Site-level controls", "Out-of-bounds flagging"],
    },
    "/features/correction-approval-workflows": {
        title: "Correction & Approval Workflows",
        image: "/showcase/dashboard.png",
        intro: "Handle missed punches with a transparent correction and approval process.",
        body: "Mistakes happen. Empower employees to fix them while maintaining a complete audit trail for managerial accountability.",
        sections: [
            {
                title: "Missed Punch Resolution",
                body: "When an employee forgets to clock out, they can submit a formal correction request detailing the actual time and reason.",
                label: "The Process",
                bullets: [
                    "Self-service correction forms",
                    "Mandatory reason codes for requests",
                    "Automatic routing to direct supervisors",
                ],
            },
            {
                title: "Managerial Oversight",
                body: "Managers receive instant notifications for pending adjustments and can review the context before approving.",
                label: "Capabilities",
                bullets: [
                    "One-click approve or reject workflows",
                    "Admin manual override abilities",
                    "Immutable audit logging of who changed what, and when",
                ],
            },
        ],
        points: ["Correction requests", "Reason codes", "Supervisor routing", "One-click approvals", "Audit trails"],
    },
    "/features/daily-activity-reports": {
        title: "Daily Activity Reports",
        image: "/showcase/dar.png",
        intro: "Enable management decisions with concise and timely workforce snapshots.",
        body: "Understand attendance behavior daily, weekly, and monthly with visual trend reporting that highlights productivity bottlenecks.",
        sections: [
            {
                title: "Shift-Level Snapshots",
                body: "Managers receive automated daily summaries detailing precisely who is present, absent, on leave, or late for a given shift.",
                label: "Capabilities",
                bullets: [
                    "Present/Absent workforce ratios",
                    "Department-level attendance rollups",
                    "Color-coded dashboards for rapid scanning",
                ],
            },
            {
                title: "Behavioral Trend Analysis",
                body: "Identify chronic lateness or unexpected absence patterns before they impact delivery timelines.",
                label: "The Value",
                bullets: [
                    "Highlight repetitive policy violations",
                    "Track overtime accumulation across teams",
                    "Export metrics for performance reviews",
                ],
            },
        ],
        points: ["Daily snapshots", "Late trends", "Overtime tracking", "Pattern analysis", "Department rollups"],
    },
    "/features/employee-management": {
        title: "Employee Management",
        image: "/showcase/employee-management.png",
        intro: "Manage employee profiles, documentation, and work policies from a central dashboard.",
        body: "Designed for HR efficiency with role-based access to securely manage organizational hierarchies and permissions.",
        sections: [
            {
                title: "Centralized Directory",
                body: "A single source of truth for all employee data, eliminating scattered spreadsheets and disconnected systems.",
                label: "Features",
                bullets: [
                    "Searchable employee database",
                    "Rich profile management (Contact, Department, Role)",
                    "Secure document storage via AWS S3",
                ],
            },
            {
                title: "Access Governance",
                body: "Ensure that sensitive data is only accessible to authorized personnel through strict capability routing.",
                label: "Security Controls",
                bullets: [
                    "Granular Role-Based Access Control (RBAC)",
                    "Separate distinct views for Admins, Managers, and Employees",
                    "Audit logs for profile modifications",
                ],
            },
        ],
        points: ["Employee database", "Rich profiles", "AWS S3 storage", "Role-Based Access (RBAC)", "Audit logging"],
    },
    "/features/payroll-ready-reports": {
        title: "Payroll Ready Reports",
        image: "/showcase/analytics.png",
        intro: "Generate exportable attendance reports that payroll teams can use immediately without manual data scrubbing.",
        body: "Reduce processing delays and calculation errors with structured, trusted data directly from the system.",
        sections: [
            {
                title: "Data Integrity",
                body: "Because the platform manages geofences, break tracking, and correction workflows, the final generated hours are fully compliant.",
                label: "Capabilities",
                bullets: [
                    "Calculates total payable work hours",
                    "Factors in unpaid breaks and strict late thresholds",
                    "Highlights policy exception flags automatically",
                ],
            },
            {
                title: "Instant Exports",
                body: "Stop spending days aggregating data at month-end. Export exactly what the finance team needs instantly.",
                label: "Export Formats",
                bullets: [
                    "Machine-readable Excel (.xlsx) exports",
                    "Presentation-ready PDF summaries",
                    "API integrations available for direct sync",
                ],
            },
        ],
        points: ["Excel & PDF exports", "Payable hours calculation", "Exception flagging", "Late minute totals", "Finance-ready formatting"],
    },
    "/features/real-time-notifications": {
        title: "Real-time Notifications",
        image: "/showcase/mobile.png",
        intro: "Keep employees and managers informed of important events as they happen, eliminating communication lags.",
        body: "Powered by socket connections and email webhooks for multi-channel, reliable communication.",
        sections: [
            {
                title: "Workflow Accelerators",
                body: "When actions require approval, the responsible manager is notified instantly. When approved, the employee finds out immediately.",
                label: "Event Triggers",
                bullets: [
                    "Instant 'Leave Request' pings to superiors",
                    "Immediate updates when attendance corrections are approved",
                    "Warning alerts for missed clock-outs",
                ],
            },
            {
                title: "Multi-Channel Delivery",
                body: "Ensure critical messages are seen by routing them to the right platform depending on the urgency.",
                label: "Delivery Mechanisms",
                bullets: [
                    "In-app push notifications via Socket.io",
                    "Configurable email summaries",
                    "Company-wide policy broadcast alerts",
                ],
            },
        ],
        points: ["Leave approvals", "Correction alerts", "Socket.io integration", "Email delivery", "Policy broadcasts"],
    },
    "/ai/ask-hr-assistant": {
        title: "\"Ask HR\" AI Assistant (Powered by RAG)",
        image: "/showcase/rag-assistant.png",
        intro: "A conversational AI chatbot trained on your company's policy documents, providing instant answers with accurate citations.",
        body: "Instead of emailing HR, employees can ask natural language questions about policies, attendance, and leave balances directly from the dashboard.",
        sections: [
            {
                title: "Retrieval-Augmented Generation (RAG)",
                body: "We feed all your company's policy documents (Leave Policy, Geofencing Rules, Holiday Calendars, Code of Conduct) into a secure vector database.",
                label: "How It Works",
                bullets: [
                    "Understands natural language queries",
                    "Retrieves exact paragraphs from company handbooks",
                    "Checks live database for personal leave balances",
                ],
            },
            {
                title: "Conversational Context",
                body: "Employees simply type: 'What's the policy on taking a half-day next week?' or 'How many sick leaves do I have left?'",
                label: "The Experience",
                bullets: [
                    "Provides perfect, conversational answers",
                    "Includes clickable citations linking to actual policy documents",
                    "Reduces HR ticket volume significantly",
                ],
            },
        ],
        points: ["Natural language queries", "Document vectorization", "Policy citations", "Live balance fetching", "HR ticket reduction"],
    },
    "/ai/smart-dar-insights": {
        title: "Smart DAR Insights (Generative AI)",
        image: "/showcase/dar-insights.png",
        intro: "Automate managerial reviews and extract business value from Daily Activity Reports (DAR) using Generative AI.",
        body: "While standard DAR capture what employees did, Smart DAR Insights explains *why it matters*. An LLM processes logs across teams to provide weekly 'AI Productivity Summaries' and identifies operational bottlenecks automatically.",
        sections: [
            {
                title: "The Basic DAR Framework",
                body: "Before AI processing, the system provides a robust framework for daily transparency and accountable reporting.",
                label: "Standard Features",
                bullets: [
                    "Structured task and project logging",
                    "Time-spent per activity tracking",
                    "Supervisor review and comment workflows",
                    "Historical log archival for performance reviews"
                ],
            },
            {
                title: "AI-Powered Productivity Layer",
                body: "Generative AI transforms raw text into boardroom-ready intelligence, saving managers hours of manual reading.",
                label: "AI Capabilities",
                bullets: [
                    "Automated Weekly Theme Synthesizing across departments",
                    "Productivity Scoring based on output vs. scheduled hours",
                    "Proactive Vague Entry Detection (flags entries like 'did work')",
                    "Anomaly detection in reporting patterns"
                ],
            },
        ],
        points: ["Basic logging", "Weekly AI summaries", "Vague entry flagging", "Theme identification", "Productivity insights"],
    },
    "/ai/generative-policy-builder": {
        title: "Generative Policy Builder (Generative AI)",
        image: "/showcase/policy-builder.png",
        intro: "Transition from rigid configuration menus to natural language policy drafting.",
        body: "Type a simple prompt, and watch the system instantly map your intent to complex backend logic, geofencing coordinates, and legal documentation.",
        sections: [
            {
                title: "Prompt to Configuration",
                body: "HR types: 'Create a night shift for the Mumbai office with a 30-min late allowance and facial verification.'",
                label: "AI Mapping",
                bullets: [
                    "Natural Language Processing of HR intents",
                    "Automatic selection of verification methods",
                    "Smart coordinate mapping for office locations",
                    "Ghost-drafting of shift rotation calendars"
                ],
            },
            {
                title: "Instant Compliance Artifacts",
                body: "The AI ensures your configurations are mirrored perfectly in employee-facing documentation.",
                label: "Benefits",
                bullets: [
                    "Auto-generates 'Terms of Work' PDF documents",
                    "Ensures guardrails match local labor laws",
                    "Reduces administrative setup time by 95%",
                    "Real-time preview of policy impact on workforce"
                ],
            },
        ],
        points: ["Prompt-based creation", "Form auto-population", "Compliance drafting", "Geofence coordinate mapping", "Instant deployment"],
    },
    "/features/admin-dashboard": {
        title: "Admin Dashboard",
        image: "/showcase/admin-dashboard.png",
        intro: "A unified command center for comprehensive workforce visibility.",
        body: "Monitor total employees, present vs absent metrics, and organizational activity trends from an intuitive high-level dashboard.",
        sections: [
            {
                title: "Macro-Level Insights",
                body: "Stop digging for data. Instantly view today's active workforce count alongside historical trend graphs.",
                label: "Key Metrics",
                bullets: [
                    "Present/Absent daily summaries",
                    "Departmental activity distribution",
                    "Beautifully curved historical activity graphs",
                ],
            },
            {
                title: "Action-Oriented Design",
                body: "Deep integrations allow admins to click directly into specific departments or reports right from the overview screen.",
                label: "The Value",
                bullets: [
                    "Saves hours of management time",
                    "Identifies staffing issues immediately",
                    "Premium dark-mode glassmorphism aesthetics",
                ],
            },
        ],
        points: ["Macro insights", "Present/Absent tracking", "Trend graphs", "Interactive elements", "Aesthetic UI"],
    },
    "/features/live-attendance": {
        title: "Live Attendance",
        image: "/showcase/live-attendance.png",
        intro: "Monitor your organization's heartbeat in real-time.",
        body: "A high-performance command center showing live employee statuses, pulsing active sessions, and immediate geographic tracking.",
        sections: [
            {
                title: "Real-Time Tracking",
                body: "The moment an employee clocks in anywhere in the world, their status on the dashboard updates to highly-visible pulsing 'Active'.",
                label: "Capabilities",
                bullets: [
                    "Pulsing session indicators",
                    "Instant check-in and out logs",
                    "Dynamic location mapping",
                ],
            },
            {
                title: "Micro-Management Erased",
                body: "Trust but verify. Map plots show exactly from which approved geofence the clock-in originated.",
                label: "The Value",
                bullets: [
                    "Absolute operational transparency",
                    "Real-time geographic plots",
                    "Supports remote and field staff",
                ],
            },
        ],
        points: ["Real-time updates", "Pulsing UI states", "Live maps", "Field staff tracking", "Operational transparency"],
    },
    "/features/comprehensive-reports": {
        title: "Comprehensive Reports",
        image: "/showcase/reports.png",
        intro: "Generate exportable attendance reports that payroll teams can use immediately without manual data scrubbing.",
        body: "Reduce processing delays and calculation errors with structured, trusted data directly from the system.",
        sections: [
            {
                title: "Data Integrity",
                body: "Because the platform manages geofences, break tracking, and correction workflows, the final generated hours are fully compliant.",
                label: "Capabilities",
                bullets: [
                    "Calculates total payable work hours",
                    "Factors in unpaid breaks and strict late thresholds",
                    "Highlights policy exception flags automatically",
                ],
            },
            {
                title: "Instant Exports",
                body: "Stop spending days aggregating data at month-end. Export exactly what the finance team needs instantly.",
                label: "Export Formats",
                bullets: [
                    "Machine-readable Excel (.xlsx) exports",
                    "Presentation-ready PDF summaries",
                    "API integrations available for direct sync",
                ],
            },
        ],
        points: ["Excel & PDF exports", "Payable hours calculation", "Exception flagging", "Late minute totals", "Finance-ready formatting"],
    },
    "/features/geo-fencing": {
        title: "Geo Fencing",
        image: "/showcase/geo-fencing-new.png",
        intro: "Track attendance against approved office and client-site radiuses.",
        body: "Location intelligence helps ensure attendance is authentic, policy-compliant, and geographically accurate.",
        sections: [
            {
                title: "Intelligent Boundaries",
                body: "Administrators can draw virtual fences around office buildings, job sites, or remote locations.",
                label: "How It Works",
                bullets: [
                    "Set allowed radius zones (e.g., 100 meters)",
                    "Validates live GPS coordinates at clock-in",
                    "Translates raw coordinates into readable addresses via Google Maps",
                ],
            },
            {
                title: "Site-Level Controls",
                body: "Different teams need different rules. Enforce strict geofencing for HQ staff while allowing city-wide radiuses for field sales.",
                label: "Capabilities",
                bullets: [
                    "Multi-location deployment support",
                    "Dynamic policy assignment per site",
                    "Flags 'Out of Bounds' attendance immediately",
                ],
            },
        ],
        points: ["Geofence boundaries", "GPS validation", "Address resolution", "Site-level controls", "Out-of-bounds flagging"],
    },
    "/features/policy-engine": {
        title: "Policy Engine",
        image: "/showcase/policy-engine.png",
        intro: "Automate complex HR rules with a deeply granular configuration engine.",
        body: "Manage shift timings, grace periods, alternate Saturday working rules, and overtime thresholds without writing custom code.",
        sections: [
            {
                title: "Complex Rule Management",
                body: "Build specific workplace realities. Account for 15-minute late grace periods, or dynamic shift alignments seamlessly.",
                label: "Capabilities",
                bullets: [
                    "Custom shift start and end buffers",
                    "Alternate Saturday calculation logic",
                    "Overtime activation thresholds",
                ],
            },
            {
                title: "Autonomous Execution",
                body: "Once defined, the rules are applied by the background Cron Processor to instantly calculate actionable infractions or warnings.",
                label: "The Value",
                bullets: [
                    "Zero manual HR calculation",
                    "Consistent rule application across the org",
                    "Fully compliant time tracking",
                ],
            },
        ],
        points: ["Shift timings", "Grace periods", "Alternate Saturdays", "Overtime rules", "Autonomous application"],
    },
    "/features/holidays-leave": {
        title: "Holidays & Leave",
        image: "/showcase/holidays-leave.png",
        intro: "A beautiful, unified calendar view for holiday and leave management.",
        body: "Empower employees to check their balances and request time off, while giving managers a transparent calendar to prevent understaffing.",
        sections: [
            {
                title: "Unified Calendar",
                body: "See company holidays and approved teammate leaves on the same visual grid.",
                label: "Features",
                bullets: [
                    "Color-coded calendar events",
                    "Instant 'pending request' highlights",
                    "Multi-tier approval flows",
                ],
            },
            {
                title: "Automated Balances",
                body: "The system dynamically tracks used vs accrued leave, preventing employees from taking more time than allowed.",
                label: "The Value",
                bullets: [
                    "Zero email chains to check balances",
                    "Enforces company leave quotas",
                    "Seamless mobile submissions",
                ],
            },
        ],
        points: ["Visual calendar", "Accrual tracking", "Multi-tier approvals", "Color-coding", "Quota enforcement"],
    },
    "/pricing": {
        title: "Pricing",
        intro: "Choose a plan that matches your team size and workforce complexity.",
        body: "From small teams to enterprise deployments, MANO-Attendance scales with your policies, locations, and reporting needs.",
        plans: [
            {
                name: "Starter Plan",
                audience: "Best for small teams",
                priceNote: "Start with essential attendance operations and simple policy controls.",
                bullets: [
                    "Attendance Tracking",
                    "Leave Management",
                    "Basic Reports",
                    "Standard onboarding support",
                ],
            },
            {
                name: "Growth Plan",
                audience: "For growing organizations",
                priceNote: "Expand into analytics, geofencing, and approval-heavy attendance workflows.",
                bullets: [
                    "All Starter features",
                    "Analytics Dashboard",
                    "Geofencing",
                    "Attendance Corrections",
                    "Enhanced role controls",
                ],
            },
            {
                name: "Enterprise Plan",
                audience: "For large organizations",
                priceNote: "Designed for multi-location governance, integrations, and advanced policy management.",
                bullets: [
                    "Advanced policies",
                    "Multi-location support",
                    "API integrations",
                    "Priority support",
                    "Enterprise onboarding assistance",
                ],
            },
        ],
        sections: [
            {
                title: "Starter Plan",
                body: "Best for small teams.",
                label: "Includes",
                bullets: [
                    "Attendance Tracking",
                    "Leave Management",
                    "Basic Reports",
                ],
            },
            {
                title: "Growth Plan",
                body: "For growing organizations.",
                label: "Includes",
                bullets: [
                    "All Starter features",
                    "Analytics Dashboard",
                    "Geofencing",
                    "Attendance Corrections",
                ],
            },
            {
                title: "Enterprise Plan",
                body: "For large organizations.",
                label: "Includes",
                bullets: [
                    "Advanced policies",
                    "Multi-location support",
                    "API integrations",
                    "Priority support",
                ],
            },
        ],
        points: ["Starter Plan", "Growth Plan", "Enterprise Plan"],
    },
    "/security": {
        title: "Security & Compliance",
        intro: "MANO-Attendance prioritizes enterprise-grade security and compliance.",
        body: "Security is built into authentication, APIs, storage, and platform-level safeguards.",
        points: [
            "JWT-based authentication",
            "Password encryption with bcrypt",
            "API security using Helmet",
            "Rate limiting for protection against abuse",
            "Secure file storage on AWS S3",
        ],
    },
    "/resources/documentation": {
        title: "Documentation",
        intro: "Implementation guides and API references for smooth onboarding.",
        body: "Set up policies, shifts, approvals, and reporting workflows with clear docs.",
        points: ["Quick start", "Admin setup", "Policy guides", "Integration notes"],
    },
    "/resources/blog": {
        title: "Blog",
        intro: "Best practices for modern attendance and workforce operations.",
        body: "Explore product updates, HR strategies, and operational playbooks.",
        points: ["Operational insights", "Product updates", "HR thought leadership", "Case-based learnings"],
    },
    "/resources/faqs": {
        title: "FAQs",
        intro: "Answers to common questions from teams evaluating MANO-Attendance.",
        body: "Everything you need to know before rollout.",
        points: [
            "How does location verification work?",
            "Is the webcam capture mandatory?",
            "Can attendance reports integrate with payroll systems?",
            "Is the platform suitable for remote teams?",
            "Does the system support multiple office locations?",
        ],
    },
    "/company/about": {
        title: "About MANO-Attendance",
        intro: "MANO-Attendance was built to solve modern workforce tracking challenges by combining accurate attendance monitoring with intelligent automation.",
        body: "Our mission is to empower organizations with reliable, transparent, and scalable workforce management solutions.",
        points: ["Accurate attendance monitoring", "Intelligent automation", "Reliable operations", "Scalable workforce management"],
    },
    "/company/contact": {
        title: "Contact",
        intro: "For product inquiries, partnerships, or support, reach out to the team.",
        body: "We usually respond within one business day.",
        contactCards: [
            "Product Support: support@manoattendance.com",
            "Sales Enquiries: sales@manoattendance.com",
            "Implementation and onboarding guidance available for new deployments",
            "Partnership conversations for consulting and channel opportunities",
        ],
        officeHours: [
            "Monday to Friday: 9:30 AM - 6:30 PM",
            "Saturday: 10:00 AM - 2:00 PM",
            "Sunday: Closed",
        ],
        supportFlow: [
            "Share your requirement or issue with key details",
            "Our team acknowledges and assigns ownership",
            "You receive updates until closure",
            "Critical cases are escalated with priority handling",
        ],
        points: [
            "Email: support@manoattendance.com",
            "Sales: sales@manoattendance.com",
        ],
    },
    "/login": {
        title: "Login",
        intro: "Access your MANO-Attendance workspace securely.",
        body: "Sign in to manage attendance, policies, leaves, and workforce analytics.",
        points: ["Secure authentication", "Role-based dashboards", "Real-time updates", "Audit visibility"],
    },
    "/get-started": {
        title: "Get Started",
        intro: "Launch your attendance platform in days with guided setup.",
        body: "Configure teams, policies, geofences, and reports quickly with implementation support.",
        points: ["Setup checklist", "Team onboarding", "Policy templates", "Go-live support"],
    },
};

export const siteData = {
    navigation,
    homeData,
    highlights: homeData.highlights,
    values: homeData.values,
    pricing: pageContent["/pricing"]?.plans?.map((p, idx) => ({
        name: p.name,
        price: idx === 0 ? "Free" : idx === 1 ? "$29" : "$99",
        period: "mo",
        features: p.bullets,
        popular: idx === 1
    })) || [],
    pageContent
};
