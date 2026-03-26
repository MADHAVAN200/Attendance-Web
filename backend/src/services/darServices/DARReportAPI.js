import express from 'express';
import { attendanceDB } from '../../config/database.js';
import { authenticateJWT } from '../../middleware/auth.js';
import catchAsync from '../../utils/catchAsync.js';
import { generateNarrativeWithGroq } from '../auth/DARLLMService.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// TABLE INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

async function ensureReportTables() {
    const hasSchedules = await attendanceDB.schema.hasTable('dar_report_schedules');
    if (!hasSchedules) {
        await attendanceDB.schema.createTable('dar_report_schedules', (t) => {
            t.increments('schedule_id').primary();
            t.integer('org_id').notNullable().index();
            t.enum('frequency', ['daily', 'weekly', 'monthly']).notNullable();
            t.string('email_to', 500).nullable();
            t.time('send_time').defaultTo('07:00:00');
            t.tinyint('day_of_week').nullable();   // 0=Sun … 6=Sat (weekly trigger day)
            t.tinyint('day_of_month').nullable();  // 1..28 (monthly trigger day)
            t.boolean('is_active').defaultTo(false);
            t.datetime('last_run_at').nullable();
            t.timestamp('created_at').defaultTo(attendanceDB.fn.now());
            t.unique(['org_id', 'frequency']);
        });
        console.log('✅ Created dar_report_schedules table');
    }

    const hasHistory = await attendanceDB.schema.hasTable('dar_report_history');
    if (!hasHistory) {
        await attendanceDB.schema.createTable('dar_report_history', (t) => {
            t.increments('report_id').primary();
            t.integer('org_id').notNullable().index();
            t.integer('user_id').nullable();  // null = all users
            t.enum('period_type', ['daily', 'weekly', 'monthly', 'custom']).notNullable();
            t.date('date_from').notNullable();
            t.date('date_to').notNullable();
            t.enum('trigger_type', ['manual', 'scheduled']).defaultTo('manual');
            t.enum('status', ['done', 'failed']).defaultTo('done');
            t.string('generated_by', 120).nullable();
            t.timestamp('created_at').defaultTo(attendanceDB.fn.now());
        });
        console.log('✅ Created dar_report_history table');
    }
}

const shouldAutoInitDarReportTables = String(process.env.DAR_REPORT_SCHEMA_AUTO_CREATE || 'false').toLowerCase() === 'true';

if (shouldAutoInitDarReportTables) {
    ensureReportTables().catch((err) => {
        if (err?.code === 'ER_TABLEACCESS_DENIED_ERROR' || err?.code === 'ER_DBACCESS_DENIED_ERROR') {
            console.warn('⚠ DAR report table auto-init skipped: database user lacks CREATE permission.');
            return;
        }
        console.error('❌ DARReportAPI table init failed:', err);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export function buildDateRange(startDate, endDate) {
    const dates = [];
    const cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    while (cursor <= end) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
}

function dedupeStrings(values) {
    return [...new Set(values.filter(Boolean))];
}

function formatList(items) {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function getDayLabel(dateStr) {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function buildDayWorkText(dayActivities) {
    if (!dayActivities || dayActivities.length === 0) return 'No DAR work uploaded.';
    const titles = dedupeStrings(dayActivities.map((item) => item.title)).slice(0, 4);
    if (titles.length > 0) return titles.join(', ');
    const categories = dedupeStrings(dayActivities.map((item) => item.activity_type)).slice(0, 3);
    return categories.length > 0 ? categories.join(', ') : 'Work updated in DAR.';
}

function buildDayMeetingText(dayEvents) {
    if (!dayEvents || dayEvents.length === 0) return 'No meetings/events.';
    const meetingTitles = dedupeStrings(dayEvents.map((event) => event.title)).slice(0, 4);
    if (meetingTitles.length > 0) return meetingTitles.join(', ');
    const meetingTypes = dedupeStrings(dayEvents.map((event) => event.type)).slice(0, 3);
    return meetingTypes.length > 0 ? meetingTypes.join(', ') : 'Meetings/events updated.';
}

function buildWeeklyWorkSummary(dateList, activitiesByDate, eventsByDate) {
    if (!dateList || dateList.length === 0) return 'No DAR work uploaded.';
    const lines = dateList.map((date, index) => (
        `${index + 1}. ${getDayLabel(date)}\n   Work: ${buildDayWorkText(activitiesByDate[date] || [])}\n   Meetings: ${buildDayMeetingText(eventsByDate[date] || [])}`
    ));
    return lines.join('\n');
}

function buildMonthlyWorkSummary(dateList, activitiesByDate, eventsByDate) {
    if (!dateList || dateList.length === 0) return 'No DAR work uploaded.';
    const weeklyBlocks = [];
    for (let i = 0; i < dateList.length; i += 7) {
        const weekDates = dateList.slice(i, i + 7);
        const weekNumber = Math.floor(i / 7) + 1;
        const weekActivities = weekDates.flatMap((date) => activitiesByDate[date] || []);
        const weekEvents = weekDates.flatMap((date) => eventsByDate[date] || []);

        const titles = dedupeStrings(weekActivities.map((item) => item.title)).slice(0, 4);
        const categories = dedupeStrings(weekActivities.map((item) => item.activity_type)).slice(0, 3);
        const meetingTitles = dedupeStrings(weekEvents.map((event) => event.title)).slice(0, 4);
        const meetingTypes = dedupeStrings(weekEvents.map((event) => event.type)).slice(0, 3);
        const activeDayCount = weekDates.filter((date) => (activitiesByDate[date] || []).length > 0).length;

        const point1 = activeDayCount > 0
            ? `Work updates were uploaded on ${activeDayCount} day(s).`
            : 'No DAR work updates were uploaded this week.';
        const point2 = titles.length > 0
            ? `Key work done: ${formatList(titles)}.`
            : 'No specific work titles were recorded.';
        const point3 = categories.length > 0
            ? `Main focus areas: ${formatList(categories)}.`
            : 'No dominant work category was recorded.';
        const point4 = meetingTitles.length > 0
            ? `Meetings/events attended: ${formatList(meetingTitles)}.`
            : (meetingTypes.length > 0
                ? `Meeting/event types: ${formatList(meetingTypes)}.`
                : 'No meetings/events were recorded this week.');

        weeklyBlocks.push([
            `Week ${weekNumber}`,
            `1. ${point1}`,
            `2. ${point2}`,
            `3. ${point3}`,
            `4. ${point4}`,
        ].join('\n'));
    }

    return weeklyBlocks.join('\n\n');
}

function buildEmployeeNarrative({ employeeName, dateList, productive, events, activitiesByDate, eventsByDate, reportType }) {
    const activeDates = dateList.filter((date) => (activitiesByDate[date] || []).length > 0 || (eventsByDate[date] || []).length > 0);
    const activityTitles = dedupeStrings(productive.map((item) => item.title)).slice(0, 6);
    const topCategories = dedupeStrings(productive.map((item) => item.activity_type)).slice(0, 3);

    if (activeDates.length === 0) {
        return {
            report_summary: `${employeeName} did not upload any DAR activity or meeting records during the selected period.`,
            work_summary: 'No work entries were recorded in the selected time frame.',
        };
    }

    const reportParts = [
        `${employeeName} submitted DAR updates on ${activeDates.length} day${activeDates.length === 1 ? '' : 's'} in the selected period.`,
    ];

    let workSummary;
    if (reportType === 'monthly' || (reportType === 'custom' && dateList.length > 7)) {
        workSummary = buildMonthlyWorkSummary(dateList, activitiesByDate, eventsByDate);
    } else {
        workSummary = buildWeeklyWorkSummary(dateList, activitiesByDate, eventsByDate);
    }

    return {
        report_summary: reportParts.join(' '),
        work_summary: workSummary,
    };
}

function normalizeClientDate(value) {
    if (!value) return null;
    return String(value).split('T')[0];
}

function normalizeClientActivities(activities = []) {
    return (activities || [])
        .map((item) => ({
            activity_date: normalizeClientDate(item.activity_date || item.date),
            title: item.title || 'Task',
            activity_type: item.activity_type || item.category || 'WORK',
            start_time: item.start_time || null,
            end_time: item.end_time || null,
        }))
        .filter((item) => Boolean(item.activity_date));
}

function normalizeClientEvents(events = []) {
    return (events || [])
        .map((item) => ({
            event_date: normalizeClientDate(item.event_date || item.date),
            title: item.title || 'Event',
            type: item.type || item.category || 'EVENT',
            start_time: item.start_time || null,
            end_time: item.end_time || null,
        }))
        .filter((item) => Boolean(item.event_date));
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYSIS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeEmployee(employee, activities, events, dateList, reportType = 'custom') {
    const productive = activities.filter((item) => item.activity_type !== 'BREAK');

    const activitiesByDate = {};
    for (const item of productive) {
        if (!activitiesByDate[item.activity_date]) activitiesByDate[item.activity_date] = [];
        activitiesByDate[item.activity_date].push(item);
    }

    const eventsByDate = {};
    for (const event of events) {
        if (!eventsByDate[event.event_date]) eventsByDate[event.event_date] = [];
        eventsByDate[event.event_date].push(event);
    }

    const narrative = buildEmployeeNarrative({
        employeeName: employee.user_name,
        dateList,
        productive,
        events,
        activitiesByDate,
        eventsByDate,
        reportType,
    });

    return {
        user_id: employee.user_id,
        user_name: employee.user_name,
        dept: employee.dept_name || '—',
        shift: employee.shift_name || '—',
        report_summary: narrative.report_summary,
        work_summary: narrative.work_summary,
        generation_mode: 'rule_based',
    };
}

async function analyzeEmployeeWithMode(orgId, employee, activities, events, dateList, reportType = 'custom', generation = 'rule_based') {
    const base = analyzeEmployee(employee, activities, events, dateList, reportType);
    if (generation !== 'llm') return base;

    const productive = activities.filter((item) => item.activity_type !== 'BREAK');

    const activitiesByDate = {};
    for (const item of productive) {
        if (!activitiesByDate[item.activity_date]) activitiesByDate[item.activity_date] = [];
        activitiesByDate[item.activity_date].push(item);
    }

    const eventsByDate = {};
    for (const event of events) {
        if (!eventsByDate[event.event_date]) eventsByDate[event.event_date] = [];
        eventsByDate[event.event_date].push(event);
    }

    const llmNarrative = await generateNarrativeWithGroq({
        employeeName: employee.user_name,
        reportType,
        dateList,
        activitiesByDate,
        eventsByDate,
    });

    return {
        ...base,
        report_summary: llmNarrative.report_summary,
        work_summary: llmNarrative.work_summary,
        generation_mode: llmNarrative.generation_mode,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED DATA FETCHER
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchReportData(orgId, employeeIds, dateStart, dateEnd) {
    const employees = await attendanceDB('users')
        .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
        .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
        .select(
            'users.user_id',
            'users.user_name',
            'departments.dept_name',
            'shifts.shift_name',
        )
        .where('users.org_id', orgId)
        .where('users.is_deleted', 0)
        .modify(q => {
            if (employeeIds && employeeIds.length > 0) {
                q.whereIn('users.user_id', employeeIds);
            }
        })
        .orderBy('users.user_name');

    const targetIds = employees.map(e => e.user_id);
    if (targetIds.length === 0) return { employees: [], activities: [], events: [] };

    const [activities, events] = await Promise.all([
        attendanceDB('daily_activities')
            .select(
                'user_id',
                'title',
                'activity_type',
                attendanceDB.raw("DATE_FORMAT(activity_date, '%Y-%m-%d') as activity_date"),
                attendanceDB.raw("TIME_FORMAT(start_time, '%H:%i:%s') as start_time"),
                attendanceDB.raw("TIME_FORMAT(end_time, '%H:%i:%s') as end_time"),
            )
            .where('org_id', orgId)
            .whereIn('user_id', targetIds)
            .whereRaw('DATE(activity_date) BETWEEN ? AND ?', [dateStart, dateEnd]),

        attendanceDB('events_meetings')
            .select(
                'user_id',
                'title',
                'type',
                attendanceDB.raw("DATE_FORMAT(event_date, '%Y-%m-%d') as event_date"),
                attendanceDB.raw("TIME_FORMAT(start_time, '%H:%i:%s') as start_time"),
                attendanceDB.raw("TIME_FORMAT(end_time, '%H:%i:%s') as end_time"),
            )
            .where('org_id', orgId)
            .whereIn('user_id', targetIds)
            .whereRaw('DATE(event_date) BETWEEN ? AND ?', [dateStart, dateEnd]),
    ]);

    return { employees, activities, events };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED REPORT BUILDER (used by API and cron)
// ─────────────────────────────────────────────────────────────────────────────

export async function buildReport(orgId, employeeIds, dateStart, dateEnd, reportType = 'custom', options = {}) {
    const generation = options?.generation === 'llm' ? 'llm' : 'rule_based';
    const { employees, activities, events } = await fetchReportData(
        orgId, employeeIds, dateStart, dateEnd
    );
    const dateList = buildDateRange(dateStart, dateEnd);

    const activitiesByUser = new Map();
    for (const a of activities) {
        if (!activitiesByUser.has(a.user_id)) activitiesByUser.set(a.user_id, []);
        activitiesByUser.get(a.user_id).push(a);
    }
    const eventsByUser = new Map();
    for (const e of events) {
        if (!eventsByUser.has(e.user_id)) eventsByUser.set(e.user_id, []);
        eventsByUser.get(e.user_id).push(e);
    }

    if (generation !== 'llm') {
        return Promise.all(employees.map(emp =>
            analyzeEmployeeWithMode(
                orgId,
                emp,
                activitiesByUser.get(emp.user_id) || [],
                eventsByUser.get(emp.user_id) || [],
                dateList,
                reportType,
                generation,
            )
        ));
    }

    const results = [];
    for (const emp of employees) {
        const row = await analyzeEmployeeWithMode(
            orgId,
            emp,
            activitiesByUser.get(emp.user_id) || [],
            eventsByUser.get(emp.user_id) || [],
            dateList,
            reportType,
            generation,
        );
        results.push(row);
    }
    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /dar/reports/preview
router.get('/preview', authenticateJWT, catchAsync(async (req, res) => {
    const { user_type, org_id } = req.user;
    if (user_type !== 'admin' && user_type !== 'HR') {
        return res.status(403).json({ ok: false, message: 'Access denied.' });
    }

    const { type = 'weekly', start, end, employeeIds, generation = 'llm' } = req.query;
    if (!start || !end) {
        return res.status(400).json({ ok: false, message: '`start` and `end` query params are required.' });
    }
    if (generation === 'llm' && !process.env.GROQ_API_KEY) {
        return res.status(400).json({ ok: false, message: 'GROQ_API_KEY is missing. Configure Groq before generating AI reports.' });
    }

    const ids = employeeIds && employeeIds !== 'all'
        ? String(employeeIds).split(',').map(Number).filter(Boolean)
        : [];

    const data = await buildReport(org_id, ids, start, end, type, { generation });

    res.json({
        ok: true,
        type,
        generation,
        date_range: { start, end },
        total_employees: data.length,
        generated_at: new Date().toISOString(),
        data,
    });
}));

// POST /dar/reports/preview/client
// Frontend sends already-fetched DAR data; backend does LLM summarization without DB reads.
router.post('/preview/client', authenticateJWT, catchAsync(async (req, res) => {
    const { user_type } = req.user;
    if (user_type !== 'admin' && user_type !== 'HR') {
        return res.status(403).json({ ok: false, message: 'Access denied.' });
    }

    const {
        type = 'weekly',
        start,
        end,
        generation = 'llm',
        employee,
        activities = [],
        events = [],
    } = req.body || {};

    if (!start || !end) {
        return res.status(400).json({ ok: false, message: '`start` and `end` are required.' });
    }
    if (!employee?.user_id || !employee?.user_name) {
        return res.status(400).json({ ok: false, message: '`employee.user_id` and `employee.user_name` are required.' });
    }
    if (generation === 'llm' && !process.env.GROQ_API_KEY) {
        return res.status(400).json({ ok: false, message: 'GROQ_API_KEY is missing. Configure Groq before generating AI reports.' });
    }

    const dateList = buildDateRange(start, end);
    const normalizedActivities = normalizeClientActivities(activities);
    const normalizedEvents = normalizeClientEvents(events);

    const employeeRow = {
        user_id: employee.user_id,
        user_name: employee.user_name,
        dept_name: employee.dept_name || '—',
        shift_name: employee.shift_name || '—',
    };

    const base = analyzeEmployee(employeeRow, normalizedActivities, normalizedEvents, dateList, type);
    let result = base;

    if (generation === 'llm') {
        const productive = normalizedActivities.filter((item) => item.activity_type !== 'BREAK');
        const activitiesByDate = {};
        for (const item of productive) {
            if (!activitiesByDate[item.activity_date]) activitiesByDate[item.activity_date] = [];
            activitiesByDate[item.activity_date].push(item);
        }

        const eventsByDate = {};
        for (const event of normalizedEvents) {
            if (!eventsByDate[event.event_date]) eventsByDate[event.event_date] = [];
            eventsByDate[event.event_date].push(event);
        }

        const llmNarrative = await generateNarrativeWithGroq({
            employeeName: employee.user_name,
            reportType: type,
            dateList,
            activitiesByDate,
            eventsByDate,
        });

        result = {
            ...base,
            report_summary: llmNarrative.report_summary,
            work_summary: llmNarrative.work_summary,
            generation_mode: llmNarrative.generation_mode,
        };
    }

    return res.json({
        ok: true,
        type,
        generation,
        date_range: { start, end },
        total_employees: 1,
        generated_at: new Date().toISOString(),
        data: [result],
    });
}));

// GET /dar/reports/history — last 50 generated reports for this org
router.get('/history', authenticateJWT, catchAsync(async (req, res) => {
    const { user_type, org_id } = req.user;
    if (user_type !== 'admin' && user_type !== 'HR') {
        return res.status(403).json({ ok: false, message: 'Access denied.' });
    }
    const history = await attendanceDB('dar_report_history')
        .where('org_id', org_id)
        .orderBy('created_at', 'desc')
        .limit(50);
    return res.json({ ok: true, history });
}));

// GET /dar/reports/schedules — list all schedule configs for this org
router.get('/schedules', authenticateJWT, catchAsync(async (req, res) => {
    const { user_type, org_id } = req.user;
    if (user_type !== 'admin' && user_type !== 'HR') {
        return res.status(403).json({ ok: false, message: 'Access denied.' });
    }
    const schedules = await attendanceDB('dar_report_schedules')
        .where('org_id', org_id)
        .orderBy('frequency');
    return res.json({ ok: true, schedules });
}));

// POST /dar/reports/schedules — upsert a schedule config
router.post('/schedules', authenticateJWT, catchAsync(async (req, res) => {
    const { user_type, org_id } = req.user;
    if (user_type !== 'admin' && user_type !== 'HR') {
        return res.status(403).json({ ok: false, message: 'Access denied.' });
    }

    const { frequency, email_to, is_active, day_of_week, day_of_month, send_time } = req.body;
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
        return res.status(400).json({ ok: false, message: 'Invalid frequency. Must be daily, weekly, or monthly.' });
    }

    const payload = {
        email_to: email_to || null,
        is_active: is_active ? 1 : 0,
        day_of_week: frequency === 'weekly' ? (day_of_week ?? null) : null,
        day_of_month: frequency === 'monthly' ? (day_of_month ?? null) : null,
        send_time: send_time || '07:00:00',
    };

    const existing = await attendanceDB('dar_report_schedules')
        .where({ org_id, frequency })
        .first();

    if (existing) {
        await attendanceDB('dar_report_schedules').where({ org_id, frequency }).update(payload);
    } else {
        await attendanceDB('dar_report_schedules').insert({ org_id, frequency, ...payload });
    }

    return res.json({ ok: true, message: 'Schedule saved.' });
}));

// DELETE /dar/reports/schedules/:frequency — remove a schedule
router.delete('/schedules/:frequency', authenticateJWT, catchAsync(async (req, res) => {
    const { user_type, org_id } = req.user;
    if (user_type !== 'admin' && user_type !== 'HR') {
        return res.status(403).json({ ok: false, message: 'Access denied.' });
    }
    const { frequency } = req.params;
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
        return res.status(400).json({ ok: false, message: 'Invalid frequency.' });
    }
    await attendanceDB('dar_report_schedules').where({ org_id, frequency }).del();
    return res.json({ ok: true, message: 'Schedule removed.' });
}));

export default router;
