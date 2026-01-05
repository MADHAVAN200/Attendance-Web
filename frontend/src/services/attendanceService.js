import api from './api';

const API_BASE_URL = "/attendance";

export const attendanceService = {
    // Check In
    async timeIn(data) {
        const formData = new FormData();
        formData.append("latitude", data.latitude);
        formData.append("longitude", data.longitude);
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
    }
};
