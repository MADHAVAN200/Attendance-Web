import api from './api';

const API_BASE_URL = "/attendance";

export const attendanceService = {
    // Check In
    async timeIn(data) {
        const formData = new FormData();
        formData.append("latitude", data.latitude);
        formData.append("longitude", data.longitude);
        formData.append("accuracy", data.accuracy);
        if (data.imageFile) {
            formData.append("image", data.imageFile);
        }
        if (data.late_reason) {
            formData.append("late_reason", data.late_reason);
        }

        try {
            const res = await api.post(`${API_BASE_URL}/timein`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to check in");
        }
    },

    // Check Out
    async timeOut(data) {
        const formData = new FormData();
        formData.append("latitude", data.latitude);
        formData.append("longitude", data.longitude);
        formData.append("accuracy", data.accuracy);
        if (data.imageFile) {
            formData.append("image", data.imageFile);
        }

        try {
            const res = await api.post(`${API_BASE_URL}/timeout`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to check out");
        }
    },

    // Get Records for a user
    async getMyRecords(dateFrom, dateTo) {
        let url = `${API_BASE_URL}/records?limit=50`;
        if (dateFrom) url += `&date_from=${dateFrom}`;
        if (dateTo) url += `&date_to=${dateTo}`;

        try {
            const res = await api.get(url);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch records");
        }
    },


    // Get Real-time Attendance (Admin)
    async getRealTimeAttendance(date) {
        // Defaults to today if no date provided
        const targetDate = date || new Date().toISOString().split('T')[0];
        let url = `${API_BASE_URL}/records/admin?date_from=${targetDate}&date_to=${targetDate}&limit=200`;

        try {
            const res = await api.get(url);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch live attendance");
        }
    },

    // Get Specific User's Daily Records (Admin Correction Context)
    async getUserDailyRecords(userId, date) {
        if (!userId || !date) return [];
        let url = `${API_BASE_URL}/records/admin?user_id=${userId}&date_from=${date}&date_to=${date}`;
        try {
            const res = await api.get(url);
            return res.data; // Helper to return just data array
        } catch (error) {
            console.error("Failed to fetch user records", error);
            return [];
        }
    },

    // Download My Monthly Report
    async downloadMyReport(month, format = "xlsx") {
        try {
            const url = `${API_BASE_URL}/records/export?month=${month}&format=${format}`;
            const response = await api.get(url, { responseType: 'blob' });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to download your report");
        }
    },

    // --- Correction Requests ---

    // Submit a new correction request
    async submitCorrectionRequest(data) {
        try {
            const res = await api.post(`${API_BASE_URL}/correction-request`, data);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || "Failed to submit correction request");
        }
    },

    // Get list of correction requests (Admin sees all, User sees own)
    async getCorrectionRequests(params = {}) {
        try {
            const res = await api.get(`${API_BASE_URL}/correction-requests`, { params });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || "Failed to fetch correction requests");
        }
    },

    // Get specific correction request details
    async getCorrectionDetails(acr_id) {
        try {
            const res = await api.get(`${API_BASE_URL}/correction-request/${acr_id}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || "Failed to fetch correction details");
        }
    },

    // Update correction status (Admin only)
    async updateCorrectionStatus(acr_id, status, review_comments, overrides = {}) {
        try {
            const res = await api.patch(`${API_BASE_URL}/correct-request/${acr_id}`, {
                status,
                review_comments,
                ...overrides
            });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || "Failed to update correction status");
        }
    },
    // Get Holidays
    async getHolidays() {
        try {
            const res = await api.get('/holiday');
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch holidays");
        }
    },

    // Employee Dashboard Stats
    async getMyStats() {
        try {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

            const res = await this.getMyRecords(startOfMonth, endOfMonth);
            const records = res.data || [];

            let daysPresent = 0;
            let lateDays = 0;
            let totalHours = 0;

            records.forEach(record => {
                if (record.time_in) daysPresent++;
                if (record.status === 'Late' || record.late_minutes > 0) lateDays++;
                if (record.duration) {
                    const [hours, minutes] = record.duration.split(':').map(Number);
                    totalHours += hours + (minutes / 60);
                }
            });

            // Note: daysAbsent requires knowing total working days, 
            // estimating for now or calculating if detailed schedule is available
            const avgHours = daysPresent > 0 ? (totalHours / daysPresent).toFixed(1) : 0;

            return {
                success: true,
                data: {
                    daysPresent,
                    daysAbsent: 0, // Mocked for simplicity without schedule logic
                    lateDays,
                    avgHours
                }
            };
        } catch (error) {
            return { success: false, data: { daysPresent: 0, daysAbsent: 0, lateDays: 0, avgHours: 0 } };
        }
    },

    // Employee Today's Status
    async getTodayStatus() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await this.getMyRecords(today, today);

            if (res.data && res.data.length > 0) {
                return { success: true, data: res.data[0] };
            }
            return { success: true, data: null };
        } catch (error) {
            return { success: false, data: null };
        }
    },

    // Upcoming Holidays
    async getUpcomingHolidays() {
        try {
            const res = await this.getHolidays();
            const holidays = res.data || [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const upcoming = holidays
                .filter(holiday => new Date(holiday.date) >= today)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            return { success: true, data: upcoming };
        } catch (error) {
            return { success: false, data: [] };
        }
    },

    // Recent Activity Feed
    async getRecentActivity() {
        try {
            const today = new Date();
            const lastWeek = new Date(today);
            lastWeek.setDate(lastWeek.getDate() - 7);

            const res = await this.getMyRecords(lastWeek.toISOString().split('T')[0], today.toISOString().split('T')[0]);
            const records = res.data || [];

            const activities = [];
            records.forEach(record => {
                if (record.time_in) {
                    activities.push({
                        id: `in-${record.acr_id}`,
                        type: 'check-in',
                        action: 'Checked In',
                        time: new Date(`${record.date}T${record.time_in}`).toLocaleString(),
                        status: record.status
                    });
                }
                if (record.time_out) {
                    activities.push({
                        id: `out-${record.acr_id}`,
                        type: 'check-out',
                        action: 'Checked Out',
                        time: new Date(`${record.date}T${record.time_out}`).toLocaleString(),
                        status: record.status
                    });
                }
            });

            // Sort descending by time
            activities.sort((a, b) => new Date(b.time) - new Date(a.time));

            return { success: true, data: activities };
        } catch (error) {
            return { success: false, data: [] };
        }
    }
};
