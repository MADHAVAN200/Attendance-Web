import { Routes, Route, Outlet } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import ProtectedRoute from "./context/protection";
import PublicRoute from "./context/publicRoute";
import Unauthorized from "./pages/Unauthorized";
import TestRoute from "./context/TestRoute";
import Login from "./pages/user-auth/Login";
import WordCaptchaTest from "./pages/test/WordCaptchaTest"; // only for testing

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
import Profile from "./pages/profile/Profile"
import Subscription from "./pages/subscription/Subscription"
import TestAPI from "./pages/test/TestAPI"
import VisualScripting from "./pages/test/VisualScripting"
import DailyActivity from "./pages/dar/DailyActivity"
import ApplyLeave from "./pages/leaves/ApplyLeave"



import EmployeeDashboard from "./pages/dashboard/EmployeeDashboard";
import { useAuth } from "./context/AuthContext";

// Component to handle role-based dashboard view
const DashboardHandler = () => {
  const { user } = useAuth();
  if (user?.user_type === 'employee') {
    return <EmployeeDashboard />;
  }
  return <AdminDashboard />;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastContainer position="top-right" autoClose={3000} />
        <Routes>

          {/* Public Route: Login */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Test Routes - Only available in Development */}
          <Route element={<TestRoute />}>
            <Route path="/word-captcha-test" element={<WordCaptchaTest />} />
            <Route path="/test-api" element={<TestAPI />} />
            <Route path="/visual-scripting" element={<VisualScripting />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/unauthorized" element={<Unauthorized />} />
            {/* Common Routes (Accessible by all authenticated users: Admin, HR, Employee) */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'hr', 'employee']} />}>
              <Route path="/" element={<DashboardHandler />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/holidays" element={<HolidayManagement />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/daily-activity" element={<DailyActivity />} />
              <Route path="/apply-leave" element={<ApplyLeave />} />
            </Route>

            {/* Admin & HR Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'hr']} />}>
              <Route path="/attendance-monitoring" element={<AttendanceMonitoring />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/policy-builder" element={<PolicyBuilder />} />
              <Route path="/geofencing" element={<GeoFencing />} />
              <Route path="/employees" element={<EmployeeList />} />
              <Route path="/employees/add" element={<EmployeeForm />} />
              <Route path="/employees/edit/:id" element={<EmployeeForm />} />
              <Route path="/employees/bulk" element={<BulkUpload />} />
            </Route>

            {/* Admin Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/subscription" element={<Subscription />} />
            </Route>
          </Route>

        </Routes>
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App
