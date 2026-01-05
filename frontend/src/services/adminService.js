import api from './api';

const API_BASE_URL = "/admin";
const POLICY_API_URL = "/policies";

export const adminService = {
    // Get all users
    async getAllUsers(includeWorkLocation = false) {
        try {
            const res = await api.get(`${API_BASE_URL}/users?workLocation=${includeWorkLocation}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch users");
        }
    },

    // Get single user
    async getUserById(userId) {
        try {
            const res = await api.get(`${API_BASE_URL}/user/${userId}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch user");
        }
    },

    // Create user
    async createUser(userData) {
        try {
            const res = await api.post(`${API_BASE_URL}/user`, userData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create user");
        }
    },

    // Update user
    async updateUser(userId, userData) {
        try {
            const res = await api.put(`${API_BASE_URL}/user/${userId}`, userData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update user");
        }
    },

    // Delete user
    async deleteUser(userId) {
        try {
            const res = await api.delete(`${API_BASE_URL}/user/${userId}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete user");
        }
    },

    // Helpers
    async getDepartments() {
        try {
            const res = await api.get(`${API_BASE_URL}/departments`);
            return res.data;
        } catch (error) {
            console.error("Failed to fetch departments", error);
            throw error;
        }
    },
    async bulkCreateUsersJson(usersData) {
        try {
            const res = await api.post(`${API_BASE_URL}/users/bulk-json`, { users: usersData });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to bulk create users");
        }
    },

    async bulkValidateUsers(usersData) {
        try {
            const res = await api.post(`${API_BASE_URL}/users/bulk-validate`, { users: usersData });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to validate users");
        }
    },

    async createDepartment(dept_name) {
        try {
            const res = await api.post(`${API_BASE_URL}/departments`, { dept_name });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create department");
        }
    },

    async createDesignation(desg_name) {
        try {
            const res = await api.post(`${API_BASE_URL}/designations`, { desg_name });
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create designation");
        }
    },

    async getDesignations() {
        try {
            const res = await api.get(`${API_BASE_URL}/designations`);
            return res.data;
        } catch (error) {
            console.error("Failed to fetch designations", error);
            throw error;
        }
    },
    async getShifts() {
        try {
            const res = await api.get(`${API_BASE_URL}/shifts`);
            return res.data;
        } catch (error) {
            console.error("Failed to fetch shifts", error);
            throw error;
        }
    },
    async createShift(shiftData) {
        try {
            // Note: Original code used POLICY_API_URL for create/update/delete shift
            const res = await api.post(`${POLICY_API_URL}/shifts`, shiftData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to create shift");
        }
    },
    async updateShift(shiftId, shiftData) {
        try {
            const res = await api.put(`${POLICY_API_URL}/shifts/${shiftId}`, shiftData);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to update shift");
        }
    },
    async deleteShift(shiftId) {
        try {
            const res = await api.delete(`${POLICY_API_URL}/shifts/${shiftId}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to delete shift");
        }
    },
    async getWorkLocations() {
        try {
            const res = await api.get(`/locations`); // Route in original was /api/locations, so since baseURL is /api, we use /locations
            return res.data;
        } catch (error) {
            console.error("Failed to fetch work locations", error);
            throw error;
        }
    },
    async getReportPreview(month, type, date = "") {
        try {
            const res = await api.get(`${API_BASE_URL}/reports/preview?month=${month}&type=${type}&date=${date}`);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch report preview");
        }
    },
    async downloadReport(month, type, format = "xlsx", userId = "", date = "") {
        try {
            const url = `${API_BASE_URL}/reports/download?month=${month}&type=${type}&format=${format}${userId ? `&user_id=${userId}` : ""}${date ? `&date=${date}` : ""}`;
            const response = await api.get(url, { responseType: 'blob' });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to download report");
        }
    },

    async getDashboardStats(range = 'weekly', month = null, year = null) {
        try {
            let url = `${API_BASE_URL}/dashboard-stats?range=${range}`;
            if (month && year) {
                url += `&month=${month}&year=${year}`;
            }
            const res = await api.get(url);
            return res.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch dashboard stats");
        }
    }
};
