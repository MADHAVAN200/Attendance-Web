import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

import ErrorBoundary from "./ErrorBoundary";
import ResponsiveRoute from "./components/ResponsiveRoute";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import ProtectedRoute from "./context/protection";
import PublicRoute from "./context/publicRoute";
import Unauthorized from "./pages/Unauthorized";
import TestRoute from "./context/TestRoute";
import Login from "./pages/user-auth/Login";
import ForgotPassword from "./pages/user-auth/ForgotPassword";
import SuperAdminLogin from "./pages/user-auth/SuperAdminLogin";
import WordCaptchaTest from "./pages/test/WordCaptchaTest"; // only for testing

import AdminDashboard from "./pages/dashboard/AdminDashboard"
import Attendance from "./pages/attendance/Attendance"
import EmployeeList from "./pages/employees/EmployeeList"
import EmployeeForm from "./pages/employees/EmployeeForm"
import BulkUpload from "./pages/employees/BulkUpload"
import AttendanceMonitoring from "./pages/attendance-monitoring/AttendanceMonitoring"
import Reports from "./pages/reports/Reports"
import HolidayManagement from "./pages/holidays/HolidayManagement"
import BulkHolidayImport from "./pages/holidays/BulkHolidayImport"
import ShiftManagement from "./pages/shift-management/ShiftManagement"
import GeoFencing from "./pages/geofencing/GeoFencing"
import Profile from "./pages/profile/Profile"
import Subscription from "./pages/subscription/Subscription"
import TestAPI from "./pages/test/TestAPI"
import VisualScripting from "./pages/test/VisualScripting"
import DailyActivity from "./pages/dar/DailyActivity"
import DARAdmin from "./pages/dar/DARAdmin"
import LeaveApplication from "./pages/holidays/LeaveApplication"
import ChatPage from "./pages/collaboration/ChatPage";

// Organization Pages Imports

import OrganizationList from "./pages/organizations/OrganizationList"
import SecurityAlerts from "./pages/super-admin/SecurityAlerts"
import UserFeedback from "./pages/super-admin/UserFeedback"
import PM2LogsConsole from "./pages/super-admin/PM2LogsConsole"

// Mobile View Imports

import MobileLogin from "./pages/user-auth/Login-mv";
import MobileForgotPassword from "./pages/user-auth/ForgotPassword-mv";
import SuperAdminLoginMobile from "./pages/user-auth/SuperAdminLogin-mv";
import MobileAdminDashboard from "./pages/dashboard/AdminDashboard-mv";
import MobileEmployeeDashboard from "./pages/dashboard/EmployeeDashboard-mv";
import MobileAttendance from "./pages/attendance/MobileAttendancePage";
import MobileEmployeeList from "./pages/employees/EmployeeList-mv";
import MobileEmployeeForm from "./pages/employees/EmployeeForm-mv";
import MobileHolidayManagement from "./pages/holidays/HolidayManagement-mv";
import MobileLeaveApplication from "./pages/holidays/LeaveApplication-mv";
import MobileProfile from "./pages/profile/Profile-mv";
import MobileAttendanceMonitoring from "./pages/attendance-monitoring/AttendanceMonitoring-mv";
import MobileShiftManagement from "./pages/shift-management/ShiftManagement-mv";
import MobileGeoFencing from "./pages/geofencing/GeoFencing-mv";
import MobileReports from "./pages/reports/Reports-mv";
import MobileNotifications from "./pages/notifications/Notifications-mv";
import MobileFeedback from "./pages/feedback/Feedback-mv";
import DailyActivityMobile from "./pages/dar/DailyActivity-mv";
import MobileBulkHolidayImport from "./pages/holidays/BulkHolidayImport-mv";
import MobileBulkUpload from "./pages/employees/BulkUpload-mv";
import SuperAdminDashboardMobile from "./pages/dashboard/SuperAdminDashboard-mv";
import OrganizationListMobile from "./pages/organizations/OrganizationList-mv";
import SecurityAlertsMobile from "./pages/super-admin/SecurityAlerts-mv";
import UserFeedbackMobile from "./pages/super-admin/UserFeedback-mv";
import MobileChatPage from "./pages/collaboration/ChatPage-mv";


import SuperAdminDashboard from "./pages/dashboard/SuperAdminDashboard";
import EmployeeDashboard from "./pages/dashboard/EmployeeDashboard";
import { useAuth } from "./context/AuthContext";
import ShowcaseNavbar from "./showcase/components/Navbar";
import ShowcaseFooter from "./showcase/components/Footer";
import ShowcaseMobileNavbar from "./showcase/components/MobileNavbar";
import ShowcaseMobileFooter from "./showcase/components/MobileFooter";
import ShowcaseTabletNavbar from "./showcase/components/TabletNavbar";
import ShowcaseTabletFooter from "./showcase/components/TabletFooter";
import ShowcaseHomePage from "./showcase/pages/HomePage";
import ShowcaseMobileHomePage from "./showcase/pages/MobileHomePage";
import ShowcaseTabletHomePage from "./showcase/pages/TabletHomePage";
import WebsiteChatbotWidget from "./showcase/components/WebsiteChatbotWidget";
import useDeviceType from "./showcase/hooks/useDeviceType";
import "./showcase/showcase.css";

const SEO_BASE_URL = "https://attendance.mano.co.in";

function upsertMetaTag(selector, attributes) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
}

function upsertCanonical(url) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const isPublicLanding = path === "/";
    const isLoginPage = path === "/login";
    const isForgotPassword = path === "/forgot-password";

    const title = isPublicLanding
      ? "MANO Attendance | Smart Attendance & Workforce Management"
      : isLoginPage
        ? "MANO Attendance Login | Secure Portal Access"
        : isForgotPassword
          ? "Forgot Password | MANO Attendance"
          : "MANO Attendance";

    const description = isPublicLanding
      ? "MANO Attendance: The ultimate smart attendance and workforce management platform with geofencing, AI insights, and payroll reports."
      : isLoginPage
        ? "Access the MANO Attendance secure login portal. Manage your workforce, track live attendance, and generate reports."
        : "MANO Attendance workforce platform.";

    const canonicalPath = isPublicLanding ? "" : isLoginPage ? "login" : isForgotPassword ? "forgot-password" : "";
    const canonicalUrl = `${SEO_BASE_URL}/${canonicalPath}`;
    const robots = isPublicLanding || isLoginPage || isForgotPassword ? "index, follow" : "noindex, nofollow";

    document.title = title;
    upsertCanonical(canonicalUrl);

    upsertMetaTag('meta[name="description"]', { name: "description", content: description });
    upsertMetaTag('meta[name="robots"]', { name: "robots", content: robots });
    upsertMetaTag('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMetaTag('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMetaTag('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMetaTag('meta[property="og:image"]', { property: "og:image", content: `${SEO_BASE_URL}/showcase/rag-assistant.png` });
    upsertMetaTag('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMetaTag('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMetaTag('meta[name="twitter:image"]', { name: "twitter:image", content: `${SEO_BASE_URL}/showcase/rag-assistant.png` });
  }, [location.pathname]);

  return null;
}

// Component to handle role-based dashboard view
const DashboardHandler = () => {
  const { user } = useAuth();
  if (user?.user_type === 'employee') {
    return <ResponsiveRoute DesktopComponent={EmployeeDashboard} MobileComponent={MobileEmployeeDashboard} />;
  }
  if (user?.user_type === 'super_admin') {
    return <ResponsiveRoute DesktopComponent={SuperAdminDashboard} MobileComponent={SuperAdminDashboardMobile} />;
  }
  return <ResponsiveRoute DesktopComponent={AdminDashboard} MobileComponent={MobileAdminDashboard} />;
};

function ShowcaseScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pathname]);

  return null;
}

const ShowcaseShell = ({ children }) => {
  const { device } = useDeviceType();
  const [theme, setTheme] = useState(() => localStorage.getItem("showcase-theme") || "dark");

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("showcase-theme", next);
      return next;
    });
  };

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light-mode");
      document.documentElement.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark-mode");
      document.documentElement.classList.remove("light-mode");
      document.documentElement.classList.add("dark");
    }
  }, [theme]);

  const NavComp = device === "mobile" ? ShowcaseMobileNavbar : device === "tablet" ? ShowcaseTabletNavbar : ShowcaseNavbar;
  const FootComp = device === "mobile" ? ShowcaseMobileFooter : device === "tablet" ? ShowcaseTabletFooter : ShowcaseFooter;

  return (
    <div className={`showcase-root site-bg ${theme}-mode`}>
      <ShowcaseScrollToTop />
      <NavComp theme={theme} toggleTheme={toggleTheme} />
      <main>{children}</main>
      <WebsiteChatbotWidget theme={theme} />
      <FootComp theme={theme} />
    </div>
  );
};

const RootHandler = () => {
  const { device } = useDeviceType();
  const PageComp = device === "mobile" ? ShowcaseMobileHomePage : device === "tablet" ? ShowcaseTabletHomePage : ShowcaseHomePage;

  return (
    <ShowcaseShell>
      <PageComp />
    </ShowcaseShell>
  );
};

const ScaleManager = () => {
  const location = useLocation();

  useEffect(() => {
    // Showcase is shown on "/"
    const isShowcase = location.pathname === "/";

    if (isShowcase) {
      document.documentElement.classList.remove("platform-zoomed");
    } else {
      document.documentElement.classList.add("platform-zoomed");
    }
  }, [location.pathname]);

  return null;
};

const MobileDashboardHandler = () => {
  const { user } = useAuth();
  if (user?.user_type === 'employee') {
    return <MobileEmployeeDashboard />;
  }
  return <MobileAdminDashboard />;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <SeoManager />
          <ScaleManager />
        <ToastContainer position="bottom-center" autoClose={3000} limit={1} hideProgressBar={true} pauseOnHover={false} pauseOnFocusLoss={false} closeOnClick={true} />
        <Routes>

          {/* Website Landing (shown first when not logged in) */}
          <Route path="/" element={<RootHandler />} />
          <Route path="/get-started" element={<Navigate to="/login" replace />} />

          {/* Public Route: Login */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<ResponsiveRoute DesktopComponent={Login} MobileComponent={MobileLogin} />} />
            <Route path="/org-login" element={<ResponsiveRoute DesktopComponent={SuperAdminLogin} MobileComponent={SuperAdminLoginMobile} />} />
            <Route path="/forgot-password" element={<ResponsiveRoute DesktopComponent={ForgotPassword} MobileComponent={MobileForgotPassword} />} />
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
            <Route element={<ProtectedRoute allowedRoles={['admin', 'hr', 'employee', 'super_admin']} />}>
              <Route path="/dashboard" element={<DashboardHandler />} />
              <Route path="/attendance" element={<ResponsiveRoute DesktopComponent={Attendance} MobileComponent={MobileAttendance} />} />
              <Route path="/holidays" element={<ResponsiveRoute DesktopComponent={HolidayManagement} MobileComponent={MobileHolidayManagement} />} />
              <Route path="/profile" element={<ResponsiveRoute DesktopComponent={Profile} MobileComponent={MobileProfile} />} />
              <Route path="/daily-activity" element={<ResponsiveRoute DesktopComponent={DailyActivity} MobileComponent={DailyActivityMobile} />} />
              <Route path="/apply-leave" element={<ResponsiveRoute DesktopComponent={LeaveApplication} MobileComponent={MobileLeaveApplication} />} />
              <Route path="/collaboration" element={<ResponsiveRoute DesktopComponent={ChatPage} MobileComponent={MobileChatPage} />} />

              {/* Mobile-Only Pages fallback */}
              <Route path="/notifications" element={<MobileNotifications />} />
              <Route path="/feedback" element={<MobileFeedback />} />
            </Route>

            {/* Admin & HR Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'hr']} />}>
              <Route path="/attendance-monitoring" element={<ResponsiveRoute DesktopComponent={AttendanceMonitoring} MobileComponent={MobileAttendanceMonitoring} />} />
              <Route path="/reports" element={<ResponsiveRoute DesktopComponent={Reports} MobileComponent={MobileReports} />} />
              <Route path="/shift-management" element={<ResponsiveRoute DesktopComponent={ShiftManagement} MobileComponent={MobileShiftManagement} />} />
              <Route path="/geofencing" element={<ResponsiveRoute DesktopComponent={GeoFencing} MobileComponent={MobileGeoFencing} />} />
              <Route path="/employees" element={<ResponsiveRoute DesktopComponent={EmployeeList} MobileComponent={MobileEmployeeList} />} />
              <Route path="/employees/add" element={<ResponsiveRoute DesktopComponent={EmployeeForm} MobileComponent={MobileEmployeeForm} />} />
              <Route path="/employees/edit/:id" element={<ResponsiveRoute DesktopComponent={EmployeeForm} MobileComponent={MobileEmployeeForm} />} />
              <Route path="/employees/bulk" element={<ResponsiveRoute DesktopComponent={BulkUpload} MobileComponent={MobileBulkUpload} />} />
              <Route path="/holidays/bulk" element={<ResponsiveRoute DesktopComponent={BulkHolidayImport} MobileComponent={MobileBulkHolidayImport} />} />
              <Route path="/dar-admin" element={<DARAdmin />} />
            </Route>

            {/* Admin Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/subscription" element={<Subscription />} />
            </Route>

            {/* Super Admin Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
              <Route path="/organizations" element={<ResponsiveRoute DesktopComponent={OrganizationList} MobileComponent={OrganizationListMobile} />} />
              <Route path="/super-admin/alerts" element={<ResponsiveRoute DesktopComponent={SecurityAlerts} MobileComponent={SecurityAlertsMobile} />} />
              <Route path="/super-admin/feedback" element={<ResponsiveRoute DesktopComponent={UserFeedback} MobileComponent={UserFeedbackMobile} />} />
              <Route path="/super-admin/logs" element={<ResponsiveRoute DesktopComponent={PM2LogsConsole} MobileComponent={PM2LogsConsole} />} />
            </Route>
          </Route>

        </Routes>
      </NotificationProvider>
    </SocketProvider>
  </AuthProvider>
  )
}

export default App
