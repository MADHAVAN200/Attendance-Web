import { Routes, Route } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./context/protection";
import PublicRoute from "./context/publicRoute";
import Login from "./pages/user-auth/Login";

import AdminDashboard from "./pages/dashboard/AdminDashboard"
import Attendance from "./pages/attendance/Attendance"
import EmployeeList from "./pages/employees/EmployeeList"
import EmployeeForm from "./pages/employees/EmployeeForm"
import BulkUpload from "./pages/employees/BulkUpload"
import AttendanceMonitoring from "./pages/attendance-monitoring/AttendanceMonitoring"
import Reports from "./pages/reports/Reports"
import HolidayManagement from "./pages/holidays/HolidayManagement"
import PolicyBuilder from "./pages/policy-builder/PolicyBuilder"
import GeoFencing from "./pages/geofencing/GeoFencing"

function App() {
  return (
    <AuthProvider>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        
        {/* Public Route: Login */}
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />

        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/attendance" element={
          <ProtectedRoute>
            <Attendance />
          </ProtectedRoute>
        } />

        <Route path="/attendance-monitoring" element={
          <ProtectedRoute>
            <AttendanceMonitoring />
          </ProtectedRoute>
        } />

        <Route path="/reports" element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        } />

        <Route path="/holidays" element={
          <ProtectedRoute>
            <HolidayManagement />
          </ProtectedRoute>
        } />

        <Route path="/policy-builder" element={
          <ProtectedRoute>
            <PolicyBuilder />
          </ProtectedRoute>
        } />

        <Route path="/geofencing" element={
          <ProtectedRoute>
            <GeoFencing />
          </ProtectedRoute>
        } />

        <Route path="/employees" element={
          <ProtectedRoute>
            <EmployeeList />
          </ProtectedRoute>
        } />

        <Route path="/employees/add" element={
          <ProtectedRoute>
            <EmployeeForm />
          </ProtectedRoute>
        } />

        <Route path="/employees/edit/:id" element={
          <ProtectedRoute>
            <EmployeeForm />
          </ProtectedRoute>
        } />

        <Route path="/employees/bulk" element={
          <ProtectedRoute>
            <BulkUpload />
          </ProtectedRoute>
        } />

      </Routes>
    </AuthProvider>
  )
}

export default App
