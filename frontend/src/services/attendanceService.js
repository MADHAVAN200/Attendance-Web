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

    // Download My Monthly Report
    async downloadMyReport(month, format = "xlsx") {
        try {
            const url = `${API_BASE_URL}/reports/download?month=${month}&type=attendance_detailed&format=${format}`;
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
    async updateCorrectionStatus(acr_id, status, review_comments) {
        try {
            const res = await api.patch(`${API_BASE_URL}/correct-request/${acr_id}`, {
                status,
                review_comments
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
};
