// mockDarService.js

// Simulate API delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock Data
const MOCK_TASKS = [
    {
        id: "t1",
        date: "2026-01-13",
        startTime: "09:30",
        endTime: "10:30",
        title: "Morning Standup",
        type: "meeting", // meeting, task, break
        description: "Daily synchronization with the team.",
    },
    {
        id: "t2",
        date: "2026-01-13",
        startTime: "11:00",
        endTime: "13:00",
        title: "Backend API Design",
        type: "task",
        description: "Designing the schema for the new module.",
    },
    {
        id: "t3",
        date: "2026-01-13",
        startTime: "14:00", // 2:00 PM
        endTime: "16:00", // 4:00 PM
        title: "Client Call",
        type: "meeting",
        description: "Discussing requirements with the client.",
    },
    {
        id: "t4",
        date: "2026-01-14",
        startTime: "9:30", // 2:00 PM
        endTime: "13:00", // 4:00 PM
        title: "Client Call",
        type: "meeting",
        description: "Discussing requirements with the client.",
    },
    {
        id: "t5",
        date: "2026-01-15",
        startTime: "9:30", // 2:00 PM
        endTime: "11:00", // 4:00 PM
        title: "summa oru meeting with client, avlo thaan vera onnum illa",
        type: "meeting",
        description: "Discussing requirements with the client.",
    }
];

const MOCK_HOLIDAYS = [
    { date: "2026-01-26", name: "Republic Day" }
];

const MOCK_LEAVES = [
    { date: "2026-01-15", type: "Sick Leave", reason: "Not feeling well" }
];

export const darService = {
    // Get tasks for a specific date
    getTasks: async (dateStr) => {
        await delay(300);
        return MOCK_TASKS.filter(t => t.date === dateStr);
    },

    // Get attendance status (mocked)
    getAttendanceStatus: async (dateStr) => {
        await delay(200);
        const today = new Date().toISOString().split('T')[0];

        // If it's today, we simulate a "Time-In" at 9:30 AM
        if (dateStr === today) {
            return {
                hasTimedIn: true,
                timeIn: "09:30",
                shiftStart: "09:00",
                shiftEnd: "18:00",
                isAbsent: false
            };
        }

        // Future date: No time-in yet, but return shift info
        if (new Date(dateStr) > new Date(today)) {
            return {
                hasTimedIn: false,
                timeIn: null,
                shiftStart: "09:00",
                shiftEnd: "18:00",
                isAbsent: false
            };
        }

        // Past date: Assume 50/50 absent/present logic or just present for simplicity
        return {
            hasTimedIn: true,
            timeIn: "09:05",
            shiftStart: "09:00",
            shiftEnd: "18:00",
            isAbsent: false
        };
    },

    // Check if date is holiday
    getHoliday: async (dateStr) => {
        return MOCK_HOLIDAYS.find(h => h.date === dateStr) || null;
    },

    // Check if user is on leave
    getLeave: async (dateStr) => {
        return MOCK_LEAVES.find(l => l.date === dateStr) || null;
    },

    // Save a new task (mock)
    saveTask: async (task) => {
        await delay(500);
        const newTask = { ...task, id: Math.random().toString(36).substr(2, 9) };
        MOCK_TASKS.push(newTask);
        return newTask;
    },

    // Delete a task (mock)
    deleteTask: async (taskId) => {
        await delay(300);
        const index = MOCK_TASKS.findIndex(t => t.id === taskId);
        if (index > -1) {
            MOCK_TASKS.splice(index, 1);
        }
        return true;
    },

    // Get upcoming meetings (Task 9)
    getUpcomingMeetings: async () => {
        await delay(400);
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        const todayStr = today.toISOString().split('T')[0];

        return MOCK_TASKS.filter(t => {
            const tDate = new Date(t.date);
            // Filter: Type is meeting, Date is >= Today AND <= Next Week
            return t.type === 'meeting' &&
                t.date >= todayStr &&
                tDate <= nextWeek;
        }).sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
        });
    },

    // Get 3 upcoming holidays
    getUpcomingHolidays: async () => {
        await delay(300);
        const today = new Date().toISOString().split('T')[0];

        // Sorting and filtering mock holidays >= today
        // Adding more dummy holidays for demo if original array is small
        const extendedHolidays = [
            ...MOCK_HOLIDAYS,
            { date: "2026-02-14", name: "Valentine's Day (Observed)" }, // Just adding for demo
            { date: "2026-03-08", name: "Women's Day" },
            { date: "2026-04-14", name: "Tamil New Year" },
        ];

        return extendedHolidays
            .filter(h => h.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 3);
    }
};

