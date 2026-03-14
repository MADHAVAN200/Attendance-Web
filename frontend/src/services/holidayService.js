import api from './api';

const API_BASE_URL = "/holiday";

export const holidayService = {
    // Get all holidays
    async getHolidays() {
        try {
            const res = await api.get(API_BASE_URL);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch holidays");
        }
    },

    // Add a new holiday
    async addHoliday(holidayData) {
        try {
            const res = await api.post(API_BASE_URL, holidayData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to add holiday");
        }
    },

    // Update a holiday
    async updateHoliday(id, holidayData) {
        try {
            const res = await api.put(`${API_BASE_URL}/${id}`, holidayData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update holiday");
        }
    },

    // Delete holidays (Supports bulk delete as per backend API)
    async deleteHolidays(ids) {
        try {
            const res = await api.delete(API_BASE_URL, { data: { ids } });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete holiday(s)");
        }
    },

    // Bulk validate holidays from parsed data
    async bulkValidateHolidays(holidaysData) {
        try {
            const res = await api.post(`${API_BASE_URL}/bulk-validate`, { holidays: holidaysData });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to validate holidays");
        }
    },

    // Bulk create holidays from JSON (after preview)
    async bulkCreateHolidaysJson(holidaysData) {
        try {
            const res = await api.post(`${API_BASE_URL}/bulk-json`, { holidays: holidaysData });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create holidays");
        }
    },

    // Upload holidays from CSV/Excel file
    async bulkUploadHolidaysFile(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post(`${API_BASE_URL}/bulk`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to upload holidays file");
        }
    }
};
