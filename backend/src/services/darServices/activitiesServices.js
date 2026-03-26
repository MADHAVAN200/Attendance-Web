import { attendanceDB } from '../../config/database.js';

const DEFAULT_SIMULATION_TEMPLATES = [
    {
        title: 'Site Visit Follow-up',
        description: 'Visited assigned site, checked progress, and documented blockers for the team.',
        activity_type: 'Site Visit'
    },
    {
        title: 'Documentation Update',
        description: 'Updated daily documentation, notes, and supporting records for ongoing work.',
        activity_type: 'Documentation'
    },
    {
        title: 'Team Coordination',
        description: 'Coordinated with internal stakeholders on priorities, dependencies, and next actions.',
        activity_type: 'Meeting'
    },
    {
        title: 'Inspection Round',
        description: 'Performed inspection, validated observations, and recorded required follow-up items.',
        activity_type: 'Inspection'
    },
    {
        title: 'Office Work Block',
        description: 'Completed desk-based work including reviews, planning, and status consolidation.',
        activity_type: 'Office Work'
    },
    {
        title: 'Client Communication',
        description: 'Followed up with client contacts, addressed queries, and shared progress updates.',
        activity_type: 'Meeting'
    },
    {
        title: 'Data Entry & Reporting',
        description: 'Entered field data into systems, cross-verified totals, and prepared summary reports.',
        activity_type: 'Documentation'
    },
    {
        title: 'Safety Compliance Check',
        description: 'Verified safety protocols, equipment readiness, and compliance documentation on-site.',
        activity_type: 'Inspection'
    },
    {
        title: 'Training Session',
        description: 'Attended or conducted training on standard procedures and upcoming policy changes.',
        activity_type: 'Meeting'
    },
    {
        title: 'Field Survey',
        description: 'Conducted on-ground measurements, captured observations, and logged survey data.',
        activity_type: 'Site Visit'
    },
    {
        title: 'Vendor Follow-up',
        description: 'Followed up on material delivery, pricing, and vendor coordination for pending orders.',
        activity_type: 'Office Work'
    },
    {
        title: 'Progress Review',
        description: 'Reviewed milestone completion, compared against plan, and flagged deviations.',
        activity_type: 'Meeting'
    }
];

function ensureDarAdminAccess(req, res) {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        res.status(403).json({ ok: false, message: 'Access denied. Admins and HR only.' });
        return false;
    }
    return true;
}

function formatDateParts(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeDateInput(value) {
    if (!value) return null;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }

        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
            return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
        }
        return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    return null;
}

function normalizeTimeInput(value) {
    if (!value) return null;

    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();

    if (/^\d{2}:\d{2}$/.test(trimmed)) {
        return `${trimmed}:00`;
    }

    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
        return trimmed;
    }

    return null;
}

function timeToMinutes(value) {
    const normalized = normalizeTimeInput(value);
    if (!normalized) return null;

    const [hours, minutes] = normalized.split(':').map(Number);
    return (hours * 60) + minutes;
}

function minutesToTime(value) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function buildSimulationTemplates(customTemplates, categories) {
    if (Array.isArray(customTemplates) && customTemplates.length > 0) {
        return customTemplates
            .map((template, index) => {
                if (!template || typeof template !== 'object') return null;

                const activityType = String(template.activity_type || template.category || `Activity ${index + 1}`).trim();
                const title = String(template.title || `${activityType} Update`).trim();
                const description = String(
                    template.description || `Completed ${activityType.toLowerCase()} work and recorded the outcome in DAR.`
                ).trim();

                if (!activityType || !title) return null;

                return {
                    title,
                    description,
                    activity_type: activityType
                };
            })
            .filter(Boolean);
    }

    if (Array.isArray(categories) && categories.length > 0) {
        const mapped = categories
            .map((category) => String(category || '').trim())
            .filter(Boolean)
            .map((category) => ({
                title: `${category} Activity`,
                description: `Completed ${category.toLowerCase()} work and updated the DAR log for the session.`,
                activity_type: category
            }));

        if (mapped.length > 0) {
            return mapped;
        }
    }

    return DEFAULT_SIMULATION_TEMPLATES;
}

function getShuffledTemplates(templates, seed) {
    const shuffled = [...templates];
    let s = Math.abs(seed) || 1;
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        s = ((s * 1103515245 + 12345) & 0x7fffffff) >>> 0;
        const j = s % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function buildSessionCandidates(records, templates, maxActivitiesPerSession, employeeSeed = 0) {
    const candidates = [];

    for (const record of records) {
        const sessionStart = timeToMinutes(record.time_in_time);
        const sessionEnd = timeToMinutes(record.time_out_time);

        if (sessionStart === null || sessionEnd === null || sessionEnd <= sessionStart) {
            continue;
        }

        const availableMinutes = sessionEnd - sessionStart;
        if (availableMinutes < 45) {
            continue;
        }

        let slotCount = Math.min(maxActivitiesPerSession, Math.max(1, Math.floor(availableMinutes / 60)));
        while (slotCount > 1) {
            const proposedSegment = Math.floor((availableMinutes - ((slotCount - 1) * 10)) / slotCount);
            if (proposedSegment >= 35) {
                break;
            }
            slotCount -= 1;
        }

        const totalGap = (slotCount - 1) * 10;
        const segmentLength = Math.max(30, Math.floor((availableMinutes - totalGap) / slotCount));

        // Unique shuffle per employee + date
        const dateSeed = record.activity_date ? record.activity_date.split('-').reduce((a, b) => a + Number(b), 0) : 0;
        const dayTemplates = getShuffledTemplates(templates, employeeSeed + dateSeed);

        let cursor = sessionStart;
        for (let index = 0; index < slotCount; index += 1) {
            const template = dayTemplates[index % dayTemplates.length];
            let startMinutes = cursor;
            let endMinutes = index === slotCount - 1
                ? sessionEnd
                : Math.min(sessionEnd, startMinutes + segmentLength);

            if (endMinutes - startMinutes < 20) {
                continue;
            }

            candidates.push({
                attendance_id: record.attendance_id,
                activity_date: record.activity_date,
                start_time: minutesToTime(startMinutes),
                end_time: minutesToTime(endMinutes),
                title: template.title,
                description: template.description,
                activity_type: template.activity_type,
                status: 'COMPLETED'
            });

            cursor = endMinutes + 10;
            if (cursor >= sessionEnd) {
                break;
            }
        }
    }

    return candidates;
}

function buildDateRange(startDate, endDate) {
    const dates = [];
    const cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    while (cursor <= end) {
        dates.push(formatDateParts(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
        cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
}

function parseShiftWindow(policyRules) {
    let parsed = policyRules;
    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed);
        } catch (error) {
            parsed = null;
        }
    }

    const startTime = normalizeTimeInput(parsed?.shift_timing?.start_time || '09:00:00') || '09:00:00';
    const endTime = normalizeTimeInput(parsed?.shift_timing?.end_time || '18:00:00') || '18:00:00';

    let startMinutes = timeToMinutes(startTime);
    let endMinutes = timeToMinutes(endTime);

    if (startMinutes === null || endMinutes === null) {
        startMinutes = 9 * 60;
        endMinutes = 18 * 60;
    }

    if (endMinutes <= startMinutes) {
        endMinutes = startMinutes + 8 * 60;
    }

    return { startMinutes, endMinutes };
}

function buildDailyCoverageCandidates(dateNeeds, templates, policyRules, maxActivitiesPerDay, options = {}) {
    const { startMinutes, endMinutes } = parseShiftWindow(policyRules);
    const candidates = [];
    const includeBreakEntries = options.includeBreakEntries === true;
    const breakDurationMinutes = Math.max(5, Math.min(60, Number(options.breakDurationMinutes) || 15));
    const employeeSeed = Number(options.employeeSeed) || 0;
    const existingSlots = options.existingSlots || [];    // [{start, end}] in minutes
    const breakTemplate = {
        title: 'Break',
        description: 'Short recovery break between focused work sessions.',
        activity_type: 'BREAK'
    };

    for (const dateNeed of dateNeeds) {
        const date = dateNeed.date;
        const requiredCount = Math.max(1, Number(dateNeed.needed) || 1);
        const dayLength = Math.max(120, endMinutes - startMinutes);
        const gap = includeBreakEntries ? breakDurationMinutes : 10;
        const minSlotLength = 20;
        const maxFeasibleSlots = Math.max(1, Math.floor((dayLength + gap) / (minSlotLength + gap)));
        const slots = Math.max(1, Math.min(requiredCount, Math.min(maxActivitiesPerDay || 1, maxFeasibleSlots)));

        // Unique shuffle per employee + date so each employee gets different task order each day
        const dateSeed = date ? date.split('-').reduce((a, b) => a + Number(b), 0) : 0;
        const dayTemplates = getShuffledTemplates(templates, employeeSeed + dateSeed);

        // Collect existing time slots for this specific date to avoid overlaps
        const dayExisting = existingSlots.filter(s => s.date === date);

        // Build free windows in the shift, subtracting existing occupied slots
        const occupiedRanges = dayExisting
            .map(s => ({ start: s.start, end: s.end }))
            .sort((a, b) => a.start - b.start);

        const freeWindows = [];
        let freeStart = startMinutes + 30;
        for (const occ of occupiedRanges) {
            if (occ.start > freeStart) {
                freeWindows.push({ start: freeStart, end: occ.start });
            }
            freeStart = Math.max(freeStart, occ.end + 5);
        }
        if (freeStart < endMinutes) {
            freeWindows.push({ start: freeStart, end: endMinutes });
        }

        // Calculate total free minutes available
        const totalFree = freeWindows.reduce((s, w) => s + (w.end - w.start), 0);
        const slotLength = Math.max(minSlotLength, Math.floor((totalFree - ((slots - 1) * gap)) / slots));

        let slotIndex = 0;
        let windowIdx = 0;
        let cursor = freeWindows.length > 0 ? freeWindows[0].start : startMinutes + 30;

        while (slotIndex < slots && windowIdx < freeWindows.length) {
            const window = freeWindows[windowIdx];
            if (cursor < window.start) cursor = window.start;
            if (cursor >= window.end) {
                windowIdx += 1;
                if (windowIdx < freeWindows.length) cursor = freeWindows[windowIdx].start;
                continue;
            }

            const template = dayTemplates[slotIndex % dayTemplates.length];
            const start = cursor;
            const maxEnd = Math.min(window.end, endMinutes);
            const end = Math.min(maxEnd, start + slotLength);

            if (end - start < minSlotLength) {
                windowIdx += 1;
                if (windowIdx < freeWindows.length) cursor = freeWindows[windowIdx].start;
                continue;
            }

            candidates.push({
                activity_date: date,
                start_time: minutesToTime(start),
                end_time: minutesToTime(end),
                title: template.title,
                description: template.description,
                activity_type: template.activity_type,
                status: 'COMPLETED'
            });

            const breakStart = end;
            const breakEnd = Math.min(maxEnd, breakStart + breakDurationMinutes);
            const hasNextSlot = slotIndex < slots - 1;

            if (includeBreakEntries && hasNextSlot && breakEnd - breakStart >= 5) {
                candidates.push({
                    activity_date: date,
                    start_time: minutesToTime(breakStart),
                    end_time: minutesToTime(breakEnd),
                    title: breakTemplate.title,
                    description: breakTemplate.description,
                    activity_type: breakTemplate.activity_type,
                    status: 'COMPLETED'
                });
            }

            cursor = end + gap;
            slotIndex += 1;

            if (cursor >= window.end) {
                windowIdx += 1;
                if (windowIdx < freeWindows.length) cursor = freeWindows[windowIdx].start;
            }
        }
    }

    return candidates;
}

const EVENT_TEMPLATES = [
    { title: 'Weekly Team Standup', type: 'MEETING', duration: 60, location: 'Conference Room A', description: 'Weekly sync with team members on progress, blockers, and next steps.' },
    { title: 'Client Review Call', type: 'MEETING', duration: 90, location: 'https://meet.google.com/abc-defg-hij', description: 'Review project status and deliverables with the client team.' },
    { title: 'Site Safety Briefing', type: 'EVENT', duration: 45, location: 'Main Site Office', description: 'Mandatory safety briefing for all site personnel before work begins.' },
    { title: 'Training Workshop', type: 'EVENT', duration: 120, location: 'Training Hall B', description: 'Skill development workshop covering new procedures and tools.' },
    { title: 'Sprint Planning', type: 'MEETING', duration: 60, location: 'Board Room', description: 'Plan upcoming sprint tasks, priorities, and resource allocation.' },
    { title: 'Vendor Coordination Meet', type: 'MEETING', duration: 75, location: 'Meeting Room 2', description: 'Coordinate delivery schedules, pricing, and quality expectations with vendors.' },
    { title: 'Progress Presentation', type: 'EVENT', duration: 90, location: 'Auditorium', description: 'Present project milestone achievements and roadmap to stakeholders.' },
    { title: 'One-on-One Review', type: 'MEETING', duration: 30, location: 'Manager Cabin', description: 'Individual performance check-in and feedback session.' },
    { title: 'Quality Audit Review', type: 'EVENT', duration: 60, location: 'QA Lab', description: 'Review quality audit findings and corrective action plans.' },
    { title: 'Cross-Team Sync', type: 'MEETING', duration: 45, location: 'https://zoom.us/j/1234567890', description: 'Alignment meeting with cross-functional teams on shared deliverables.' },
    { title: 'Compliance Orientation', type: 'EVENT', duration: 60, location: 'HR Conference Room', description: 'Orientation session on updated compliance policies and procedures.' },
    { title: 'Design Review', type: 'MEETING', duration: 90, location: 'Design Studio', description: 'Review and approve design specifications before implementation phase.' }
];

function buildEventCandidates(dateList, policyRules, employeeSeed, existingOccupiedSlots) {
    const { startMinutes, endMinutes } = parseShiftWindow(policyRules);
    const events = [];

    // Determine which dates get events: ~2-3 events per week (roughly 30-40% of days)
    let seed = Math.abs(employeeSeed * 7 + 31) || 1;
    const nextRand = () => {
        seed = ((seed * 1103515245 + 12345) & 0x7fffffff) >>> 0;
        return seed;
    };

    for (const date of dateList) {
        // Each employee-date combo gets a deterministic yes/no for event
        const dateSeed = date.split('-').reduce((a, b) => a + Number(b), 0);
        const combinedSeed = employeeSeed + dateSeed;
        let r = Math.abs(combinedSeed * 2654435761) >>> 0;
        // ~35% chance of having an event on any given day
        if ((r % 100) >= 35) continue;

        // Pick a template deterministically based on employee + date
        const shuffled = getShuffledTemplates(EVENT_TEMPLATES, combinedSeed);
        const template = shuffled[0];

        // Pick a start time within the shift window, biased toward mid-morning or afternoon
        const dayOccupied = existingOccupiedSlots.filter(s => s.date === date);
        const shiftRange = endMinutes - startMinutes;

        // Try a few random-ish start offsets
        let placed = false;
        for (let attempt = 0; attempt < 5 && !placed; attempt += 1) {
            const offset = nextRand() % Math.max(1, shiftRange - template.duration);
            const evStart = startMinutes + offset;
            const evEnd = Math.min(endMinutes, evStart + template.duration);

            if (evEnd - evStart < 20) continue;

            // Verify no overlap with existing occupied slots for this date
            const hasOverlap = dayOccupied.some(o => evStart < o.end && evEnd > o.start);
            if (hasOverlap) continue;

            events.push({
                date,
                start_time: minutesToTime(evStart),
                end_time: minutesToTime(evEnd),
                title: template.title,
                description: template.description,
                type: template.type,
                location: template.location
            });

            // Add to occupied so DAR activities avoid this slot
            existingOccupiedSlots.push({ date, start: evStart, end: evEnd });
            placed = true;
        }
    }

    return events;
}

function buildDuplicateKey(activityDate, startTime, endTime, title) {
    return [activityDate, normalizeTimeInput(startTime), normalizeTimeInput(endTime), String(title || '').trim().toLowerCase()].join('|');
}

async function runGenerateSimulation(orgId, payload) {
    const target = payload.target || {};
    const countPerEmployee = Math.max(1, Number(payload.countPerEmployee) || 50);
    const maxActivitiesPerSession = Math.max(1, Math.min(8, Number(payload.maxActivitiesPerSession) || 4));
    const overwriteExisting = payload.overwriteExisting === true;
    const ensureDailyCoverage = payload.ensureDailyCoverage !== false;
    const fallbackActivitiesPerDay = Math.max(1, Math.min(12, Number(payload.fallbackActivitiesPerDay) || 4));
    const dailyTargetActivities = Math.max(1, Math.min(12, Number(payload.dailyTargetActivities) || fallbackActivitiesPerDay));
    const includeBreakEntries = payload.includeBreakEntries !== false;
    const breakDurationMinutes = Math.max(5, Math.min(60, Number(payload.breakDurationMinutes) || 15));
    const includeInactive = target.includeInactive === true;
    const dateStart = normalizeDateInput(payload.dateRange?.start);
    const dateEnd = normalizeDateInput(payload.dateRange?.end);

    if (!dateStart || !dateEnd) {
        throw new Error('dateRange.start and dateRange.end must be valid YYYY-MM-DD values.');
    }

    if (dateStart > dateEnd) {
        throw new Error('dateRange.start cannot be later than dateRange.end.');
    }

    let employeeQuery = attendanceDB('users')
        .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
        .select('users.user_id', 'users.user_name', 'users.is_active', 'users.is_deleted', 'shifts.policy_rules')
        .where('users.org_id', orgId)
        .where('users.is_deleted', 0);

    // By default target all user types; restrict to specific types if provided
    const targetUserTypes = Array.isArray(target.userTypes) && target.userTypes.length > 0
        ? target.userTypes
        : null;
    if (targetUserTypes) {
        employeeQuery = employeeQuery.whereIn('users.user_type', targetUserTypes);
    }

    const userIds = target.userIds;
    if (Array.isArray(userIds) && userIds.length > 0) {
        employeeQuery = employeeQuery.whereIn('user_id', userIds);
    }

    if (!includeInactive) {
        employeeQuery = employeeQuery.where('is_active', 1);
    }

    const employees = await employeeQuery.orderBy('user_name', 'asc');
    if (employees.length === 0) {
        return {
            mode: 'generate',
            countPerEmployee,
            totalEmployees: 0,
            totalInserted: 0,
            employees: [],
            message: 'No eligible employees found for simulation.'
        };
    }

    const settings = await attendanceDB('dar_settings').where({ org_id: orgId }).first();
    let categories = [];
    if (settings?.categories) {
        try {
            categories = typeof settings.categories === 'string' ? JSON.parse(settings.categories) : settings.categories;
        } catch (error) {
            categories = [];
        }
    }

    const templates = buildSimulationTemplates(payload.templates, payload.categories || categories);

    if (!templates.length) {
        throw new Error('At least one DAR activity template is required to generate simulation data.');
    }

    const employeeIds = employees.map((employee) => employee.user_id);
    const dateList = buildDateRange(dateStart, dateEnd);

    const attendanceRecords = await attendanceDB('attendance_records')
        .select(
            'attendance_id',
            'user_id',
            attendanceDB.raw("DATE_FORMAT(time_in, '%Y-%m-%d') as activity_date"),
            attendanceDB.raw("DATE_FORMAT(time_in, '%H:%i:%s') as time_in_time"),
            attendanceDB.raw("DATE_FORMAT(time_out, '%H:%i:%s') as time_out_time")
        )
        .where('org_id', orgId)
        .whereIn('user_id', employeeIds)
        .whereRaw('DATE(time_in) >= ?', [dateStart])
        .whereRaw('DATE(time_in) <= ?', [dateEnd])
        .whereNotNull('time_in')
        .whereNotNull('time_out')
        .orderBy('user_id', 'asc')
        .orderBy('time_in', 'asc');

    const existingActivities = await attendanceDB('daily_activities')
        .select(
            'user_id',
            'title',
            attendanceDB.raw("DATE_FORMAT(activity_date, '%Y-%m-%d') as activity_date"),
            attendanceDB.raw("DATE_FORMAT(start_time, '%H:%i:%s') as start_time"),
            attendanceDB.raw("DATE_FORMAT(end_time, '%H:%i:%s') as end_time")
        )
        .where('org_id', orgId)
        .whereIn('user_id', employeeIds)
        .whereRaw('DATE(activity_date) >= ?', [dateStart])
        .whereRaw('DATE(activity_date) <= ?', [dateEnd]);

    // Also fetch events/meetings so simulated activities never overlap with them
    const existingEvents = await attendanceDB('events_meetings')
        .select(
            'user_id',
            attendanceDB.raw("DATE_FORMAT(event_date, '%Y-%m-%d') as activity_date"),
            attendanceDB.raw("TIME_FORMAT(start_time, '%H:%i:%s') as start_time"),
            attendanceDB.raw("TIME_FORMAT(end_time, '%H:%i:%s') as end_time")
        )
        .where('org_id', orgId)
        .whereIn('user_id', employeeIds)
        .whereRaw('DATE(event_date) >= ?', [dateStart])
        .whereRaw('DATE(event_date) <= ?', [dateEnd]);

    const attendanceByUser = new Map();
    for (const record of attendanceRecords) {
        if (!attendanceByUser.has(record.user_id)) {
            attendanceByUser.set(record.user_id, []);
        }
        attendanceByUser.get(record.user_id).push(record);
    }

    const existingByUser = new Map();
    for (const activity of existingActivities) {
        if (!existingByUser.has(activity.user_id)) {
            existingByUser.set(activity.user_id, []);
        }
        existingByUser.get(activity.user_id).push(activity);
    }

    // Build events-by-user map (events are never deleted, always treated as occupied)
    const eventsByUser = new Map();
    for (const event of existingEvents) {
        if (!eventsByUser.has(event.user_id)) {
            eventsByUser.set(event.user_id, []);
        }
        eventsByUser.get(event.user_id).push(event);
    }

    const summary = [];
    let totalInserted = 0;

    await attendanceDB.transaction(async (trx) => {
        for (const employee of employees) {
            const userSessions = attendanceByUser.get(employee.user_id) || [];
            const userExistingActivities = existingByUser.get(employee.user_id) || [];
            const userEvents = eventsByUser.get(employee.user_id) || [];

            if (overwriteExisting) {
                await trx('daily_activities')
                    .where({ org_id: orgId, user_id: employee.user_id })
                    .whereRaw('DATE(activity_date) >= ?', [dateStart])
                    .whereRaw('DATE(activity_date) <= ?', [dateEnd])
                    .del();
            }

            const existingCount = overwriteExisting ? 0 : userExistingActivities.length;
            const neededCount = Math.max(0, countPerEmployee - existingCount);

            const coverageNeededByDate = new Map();
            if (ensureDailyCoverage) {
                for (const date of dateList) {
                    coverageNeededByDate.set(date, dailyTargetActivities);
                }

                const existingDailyCount = new Map();
                if (!overwriteExisting) {
                    for (const existing of userExistingActivities) {
                        existingDailyCount.set(
                            existing.activity_date,
                            (existingDailyCount.get(existing.activity_date) || 0) + 1
                        );
                    }
                }

                for (const date of dateList) {
                    const existingCountForDate = overwriteExisting ? 0 : (existingDailyCount.get(date) || 0);
                    coverageNeededByDate.set(date, Math.max(0, dailyTargetActivities - existingCountForDate));
                }
            }

            const uncoveredDates = [...coverageNeededByDate.entries()]
                .filter(([, needed]) => needed > 0)
                .map(([date, needed]) => ({ date, needed }));

            // Build occupied time slots from: events (always) + existing activities (when not overwriting)
            // Events are NEVER deleted by overwrite, so they always count as occupied
            const allOccupiedSlots = [];

            // Events are always occupied (they aren't deleted by overwrite)
            for (const ev of userEvents) {
                const s = timeToMinutes(ev.start_time);
                const e = timeToMinutes(ev.end_time);
                if (s !== null && e !== null && e > s) {
                    allOccupiedSlots.push({ date: ev.activity_date, start: s, end: e });
                }
            }

            // Existing activities are occupied only when not overwriting
            if (!overwriteExisting) {
                for (const a of userExistingActivities) {
                    const s = timeToMinutes(a.start_time);
                    const e = timeToMinutes(a.end_time);
                    if (s !== null && e !== null && e > s) {
                        allOccupiedSlots.push({ date: a.activity_date, start: s, end: e });
                    }
                }
            }

            // Generate events/meetings for this employee on ~35% of days
            // Events are generated BEFORE DAR activities so activities route around them
            if (overwriteExisting) {
                // Remove previously simulated events (keep only ones created before the simulator existed,
                // i.e. ones with a description matching our template pattern)
                await trx('events_meetings')
                    .where({ org_id: orgId, user_id: employee.user_id })
                    .whereRaw('DATE(event_date) >= ?', [dateStart])
                    .whereRaw('DATE(event_date) <= ?', [dateEnd])
                    .where('description', 'like', '%[simulated]%')
                    .del();
            }

            const newEvents = buildEventCandidates(dateList, employee.policy_rules, employee.user_id, allOccupiedSlots);
            // allOccupiedSlots is already updated by buildEventCandidates (it pushes into it)

            if (newEvents.length > 0) {
                const eventInserts = newEvents.map(ev => ({
                    org_id: orgId,
                    user_id: employee.user_id,
                    title: ev.title,
                    description: `${ev.description} [simulated]`,
                    event_date: ev.date,
                    start_time: ev.start_time,
                    end_time: ev.end_time,
                    location: ev.location,
                    type: ev.type,
                    created_at: attendanceDB.fn.now(),
                    updated_at: attendanceDB.fn.now()
                }));
                await trx('events_meetings').insert(eventInserts);
            }

            const coverageCandidates = ensureDailyCoverage
                ? buildDailyCoverageCandidates(
                    uncoveredDates,
                    templates,
                    employee.policy_rules,
                    fallbackActivitiesPerDay,
                    { includeBreakEntries, breakDurationMinutes, employeeSeed: employee.user_id, existingSlots: allOccupiedSlots }
                )
                : [];

            // Only use coverage candidates — avoids double-generation with session candidates
            const candidates = coverageCandidates;

            const minimumCoverageCount = ensureDailyCoverage
                ? uncoveredDates.reduce((sum, item) => sum + item.needed, 0)
                : 0;
            const requiredInsertCount = Math.max(neededCount, minimumCoverageCount);

            if (requiredInsertCount === 0) {
                summary.push({
                    user_id: employee.user_id,
                    user_name: employee.user_name,
                    inserted_count: 0,
                    events_created: newEvents.length,
                    existing_count: userExistingActivities.length,
                    target_count: countPerEmployee,
                    achieved_count: userExistingActivities.length,
                    skipped_reason: 'already_meets_target'
                });
                continue;
            }

            // Build occupied time ranges per date for overlap detection during insert
            // Always include events; include existing activities only when not overwriting
            const occupiedByDate = new Map();
            for (const slot of allOccupiedSlots) {
                if (!occupiedByDate.has(slot.date)) occupiedByDate.set(slot.date, []);
                occupiedByDate.get(slot.date).push({ start: slot.start, end: slot.end });
            }

            const duplicateKeys = new Set(
                overwriteExisting
                    ? []
                    : userExistingActivities.map((activity) => buildDuplicateKey(activity.activity_date, activity.start_time, activity.end_time, activity.title))
            );

            const insertedDates = new Set();

            const inserts = [];
            for (const candidate of candidates) {
                if (inserts.length >= requiredInsertCount) {
                    break;
                }

                const key = buildDuplicateKey(candidate.activity_date, candidate.start_time, candidate.end_time, candidate.title);
                if (duplicateKeys.has(key)) {
                    continue;
                }

                // Check for time overlap with existing + already-inserted activities
                const candStart = timeToMinutes(candidate.start_time);
                const candEnd = timeToMinutes(candidate.end_time);
                if (candStart !== null && candEnd !== null) {
                    const dateOccupied = occupiedByDate.get(candidate.activity_date) || [];
                    const hasOverlap = dateOccupied.some(o => candStart < o.end && candEnd > o.start);
                    if (hasOverlap) {
                        continue;
                    }
                    // Track this new slot as occupied
                    if (!occupiedByDate.has(candidate.activity_date)) occupiedByDate.set(candidate.activity_date, []);
                    occupiedByDate.get(candidate.activity_date).push({ start: candStart, end: candEnd });
                }

                duplicateKeys.add(key);
                inserts.push({
                    org_id: orgId,
                    user_id: employee.user_id,
                    activity_date: candidate.activity_date,
                    start_time: candidate.start_time,
                    end_time: candidate.end_time,
                    title: candidate.title,
                    description: candidate.description,
                    activity_type: candidate.activity_type,
                    status: candidate.status,
                    created_at: attendanceDB.fn.now(),
                    updated_at: attendanceDB.fn.now()
                });

                insertedDates.add(candidate.activity_date);
            }

            if (inserts.length > 0) {
                await trx('daily_activities').insert(inserts);
                totalInserted += inserts.length;
            }

            summary.push({
                user_id: employee.user_id,
                user_name: employee.user_name,
                inserted_count: inserts.length,
                events_created: newEvents.length,
                existing_count: userExistingActivities.length,
                target_count: countPerEmployee,
                achieved_count: overwriteExisting ? inserts.length : (userExistingActivities.length + inserts.length),
                available_sessions: userSessions.length,
                covered_dates: insertedDates.size + (overwriteExisting ? 0 : (dateList.length - uncoveredDates.filter((d) => d.needed > 0).length)),
                total_dates: dateList.length,
                skipped_reason: inserts.length < requiredInsertCount ? 'insufficient_generation_candidates' : null
            });
        }
    });

    const totalEventsCreated = summary.reduce((s, e) => s + (e.events_created || 0), 0);

    return {
        mode: 'generate',
        countPerEmployee,
        dailyTargetActivities,
        includeBreakEntries,
        breakDurationMinutes,
        totalEmployees: employees.length,
        totalInserted,
        totalEventsCreated,
        employees: summary,
        message: `DAR simulation completed for ${employees.length} employees. ${totalEventsCreated} events created.`
    };
}

async function runImportSimulation(orgId, payload) {
    const records = Array.isArray(payload.records) ? payload.records : [];

    if (records.length === 0) {
        throw new Error('records must be a non-empty array when mode is import.');
    }

    const employeeIds = [...new Set(records.map((record) => Number(record.user_id)).filter(Boolean))];
    if (employeeIds.length === 0) {
        throw new Error('Each import record must include a valid user_id.');
    }

    const employees = await attendanceDB('users')
        .select('user_id', 'user_name')
        .where({ org_id: orgId })
        .whereIn('user_id', employeeIds);

    const employeeMap = new Map(employees.map((employee) => [employee.user_id, employee]));
    const invalidUser = employeeIds.find((userId) => !employeeMap.has(userId));
    if (invalidUser) {
        throw new Error(`User ID ${invalidUser} does not belong to this organization.`);
    }

    const inserts = records.map((record, index) => {
        const activityDate = normalizeDateInput(record.activity_date);
        const startTime = normalizeTimeInput(record.start_time);
        const endTime = normalizeTimeInput(record.end_time);
        const userId = Number(record.user_id);

        if (!activityDate || !startTime || !endTime) {
            throw new Error(`Record ${index + 1} must include valid activity_date, start_time, and end_time values.`);
        }

        if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
            throw new Error(`Record ${index + 1} has end_time earlier than or equal to start_time.`);
        }

        return {
            org_id: orgId,
            user_id: userId,
            activity_date: activityDate,
            start_time: startTime,
            end_time: endTime,
            title: String(record.title || 'Imported DAR Activity').trim(),
            description: String(record.description || 'Imported from DAR simulation JSON.').trim(),
            activity_type: String(record.activity_type || 'Imported').trim(),
            status: String(record.status || 'COMPLETED').trim().toUpperCase(),
            created_at: attendanceDB.fn.now(),
            updated_at: attendanceDB.fn.now()
        };
    });

    await attendanceDB('daily_activities').insert(inserts);

    return {
        mode: 'import',
        totalEmployees: employeeIds.length,
        totalInserted: inserts.length,
        employees: employees.map((employee) => ({
            user_id: employee.user_id,
            user_name: employee.user_name,
            inserted_count: inserts.filter((item) => item.user_id === employee.user_id).length
        })),
        message: `Imported ${inserts.length} DAR records from JSON.`
    };
}

// Helper: Get Org Buffer Settings
export async function getOrgBuffer(org_id) {
    const settings = await attendanceDB("dar_settings").where({ org_id }).first();
    return settings ? settings.buffer_minutes : 30;
}

// Helper: Validation Logic
export async function validateActivityTime(user_id, date, start_time, end_time, buffer_minutes) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (date > todayStr) {
        return { valid: true, mode: 'PLANNING' };
    }

    const activityEndDateTime = new Date(`${date}T${end_time}`);
    const allowedEndDateTime = new Date(now.getTime() + buffer_minutes * 60000);

    if (date === todayStr) {
        if (activityEndDateTime > allowedEndDateTime) {
            return { valid: false, message: `Cannot log future tasks (Buffer: ${buffer_minutes}m). Allowed until: ${allowedEndDateTime.toLocaleTimeString()}` };
        }
    }

    const attendance = await attendanceDB("attendance_records")
        .where("user_id", user_id)
        .whereRaw("DATE(time_in) = ?", [date])
        .orderBy("time_in", "asc");

    if (!attendance || attendance.length === 0) {
        return { valid: false, message: "No attendance record found for this date." };
    }

    const getMinutes = (timeStr) => {
        if (!timeStr) return null;
        if (timeStr.includes('T') || timeStr.includes('-')) {
            const d = new Date(timeStr);
            return d.getHours() * 60 + d.getMinutes();
        }
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const startMins = getMinutes(start_time);
    const endMins = getMinutes(end_time);

    let isWithinSession = false;

    for (const session of attendance) {
        const sessionStart = new Date(session.time_in);
        const sessStartMins = sessionStart.getHours() * 60 + sessionStart.getMinutes();

        let sessEndMins = 24 * 60;
        if (session.time_out) {
            const sessionEnd = new Date(session.time_out);
            sessEndMins = sessionEnd.getHours() * 60 + sessionEnd.getMinutes();
        }

        if (startMins >= sessStartMins && endMins <= sessEndMins) {
            isWithinSession = true;
            break;
        }
    }

    if (!isWithinSession) {
        return { valid: false, message: `Task time (${start_time}-${end_time}) must be within a valid 'Time In' session.` };
    }

    return { valid: true, mode: 'EXECUTION' };
}

// Helper: Shared Validation & Status Determination
export async function processActivityValidation(org_id, user_id, body) {
    const { activity_date, start_time, end_time } = body;
    const buffer = await getOrgBuffer(org_id);
    const check = await validateActivityTime(user_id, activity_date, start_time, end_time, buffer);

    if (!check.valid) {
        throw new Error(check.message);
    }

    return check.mode === 'PLANNING' ? 'PLANNED' : 'COMPLETED';
}

export async function createActivity({ org_id, user_id, activity_date, start_time, end_time, title, description, activity_type, status }) {
    const [activity_id] = await attendanceDB("daily_activities").insert({
        org_id,
        user_id,
        activity_date,
        start_time,
        end_time,
        title,
        description,
        activity_type,
        status,
        created_at: attendanceDB.fn.now()
    });
    return activity_id;
}

export async function updateActivity({ activity_id, org_id, user_id, activity_date, start_time, end_time, title, description, activity_type, status }) {
    await attendanceDB("daily_activities")
        .where({ activity_id, org_id, user_id })
        .update({
            activity_date,
            start_time,
            end_time,
            title,
            description,
            activity_type,
            status,
            updated_at: attendanceDB.fn.now()
        });
}

export async function deleteActivity({ activity_id, org_id, user_id }) {
    return attendanceDB("daily_activities")
        .where({ activity_id, org_id, user_id })
        .del();
}

export async function listActivities({ org_id, user_id, date, date_from, date_to }) {
    let query = attendanceDB("daily_activities")
        .select(
            "*",
            attendanceDB.raw("DATE_FORMAT(activity_date, '%Y-%m-%d') as activity_date")
        )
        .where({ org_id, user_id });

    if (date) {
        query.where("activity_date", date);
    } else if (date_from && date_to) {
        query.whereBetween("activity_date", [date_from, date_to]);
    }

    return query.orderBy("activity_date", "asc").orderBy("start_time", "asc");
}

export async function getAllActivitiesAdmin({ org_id, date, startDate, endDate }) {
    let query = attendanceDB('daily_activities as da')
        .join('users as u', 'da.user_id', 'u.user_id')
        .leftJoin('departments as dep', 'u.dept_id', 'dep.dept_id')
        .leftJoin('shifts as s', 'u.shift_id', 's.shift_id')
        .select(
            'da.activity_id',
            'da.activity_id as id',
            'da.org_id',
            'da.user_id',
            attendanceDB.raw("DATE_FORMAT(da.activity_date, '%Y-%m-%d') as activity_date"),
            attendanceDB.raw("TIME_FORMAT(da.start_time, '%H:%i:%s') as start_time"),
            attendanceDB.raw("TIME_FORMAT(da.end_time, '%H:%i:%s') as end_time"),
            'da.title',
            'da.description',
            'da.activity_type',
            'da.status',
            'da.created_at',
            'da.updated_at',
            'u.user_name',
            'u.user_type as user_role',
            'u.email as user_email',
            'dep.dept_name as user_dept',
            's.shift_name as user_shift_name'
        )
        .where('da.org_id', org_id)
        .where('da.status', 'COMPLETED');

    // Filter by date or range — use DATE() to avoid timezone-offset issues with DATE columns
    if (date) {
        query = query.whereRaw('DATE(da.activity_date) = ?', [date]);
    } else if (startDate && endDate) {
        query = query.whereRaw('DATE(da.activity_date) BETWEEN ? AND ?', [startDate, endDate]);
    }

    return query.orderBy('da.activity_date', 'desc').orderBy('u.user_name', 'asc');
}