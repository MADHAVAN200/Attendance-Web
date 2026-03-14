import catchAsync from "../../utils/catchAsync.js";
import * as MapsService from "../../services/google_api_services/maps.js";
import { getEventSource } from "../../utils/clientInfo.js";
import * as AttendanceService from "../../services/attendance/attendanceService.js";

/**
 * POST /attendance/timein
 * Handle user check-in with location and optional image
 */
export const timeIn = catchAsync(async (req, res) => {
  // 1. DATA PREPARATION
  const { user_id, org_id } = req.user;
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const accuracy = Number(req.body.accuracy);
  const late_reason = req.body.late_reason || null;
  const file = req.file;

  // 2. CONTEXT LOADING (Google Maps)
  const nowUTC = new Date().toISOString();
  let tz = { localTime: nowUTC, tzName: "UTC" };
  let address = "Unknown Location";

  try {
    if (!isNaN(latitude) && !isNaN(longitude)) {
      tz = await MapsService.fetchTimeStamp(latitude, longitude, nowUTC);
      const addrRes = await MapsService.coordsToAddress(latitude, longitude);
      if (addrRes) address = addrRes.address;
    }
  } catch (e) {
    console.error("Maps API Error:", e);
  }

  // 3. DELEGATE TO SERVICE
  const result = await AttendanceService.processTimeIn({
    user_id,
    org_id,
    latitude,
    longitude,
    accuracy,
    late_reason,
    file,
    localTime: tz.localTime,
    address,
    timezone: tz.tzName,
    ip: req.clientIp || req.ip,
    user_agent: req.get('User-Agent'),
    event_source: getEventSource(req)
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

  return res.json(result);
});

/**
 * POST /attendance/timeout
 * Handle user check-out with location and optional image
 */
export const timeOut = catchAsync(async (req, res) => {
  // 1. DATA PREPARATION
  const { user_id, org_id } = req.user;
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const accuracy = Number(req.body.accuracy);
  const file = req.file;

  // 2. CONTEXT LOADING
  const nowUTC = new Date().toISOString();
  let tz = { localTime: nowUTC, tzName: "UTC" };
  let address = "Unknown Location";

  try {
    if (!isNaN(latitude) && !isNaN(longitude)) {
      tz = await MapsService.fetchTimeStamp(latitude, longitude, nowUTC);
      const addrRes = await MapsService.coordsToAddress(latitude, longitude);
      if (addrRes) address = addrRes.address;
    }
  } catch (e) {
    console.error("Maps API Error", e);
  }

  // 3. DELEGATE TO SERVICE
  const result = await AttendanceService.processTimeOut({
    user_id,
    org_id,
    latitude,
    longitude,
    accuracy,
    file,
    localTime: tz.localTime,
    address,
    timezone: tz.tzName,
    ip: req.clientIp || req.ip,
    user_agent: req.get('User-Agent'),
    event_source: getEventSource(req)
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

  return res.json(result);
});

/**
 * POST /attendance/simulate/timein
 * DEVELOPMENT ONLY - Simulate check-in with custom timestamp
 */
export const simulateTimeIn = catchAsync(async (req, res) => {
  // DEVELOPMENT ONLY
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ ok: false, message: "Not Found" });
  }

  // Allow admin to simulate for others
  let target_user_id = req.user.user_id;
  if (req.body.user_id && req.user.user_type === "admin") {
    target_user_id = req.body.user_id;
  }

  const {
    latitude = 0,
    longitude = 0,
    accuracy = 10,
    simulated_time,
    simulated_address = "Simulated Location",
    late_reason
  } = req.body;

  const file = req.file;

  if (!simulated_time) {
    return res.status(400).json({ ok: false, message: "simulated_time (ISO format) is required" });
  }

  const result = await AttendanceService.processTimeIn({
    user_id: target_user_id,
    org_id: req.user.org_id,
    latitude,
    longitude,
    accuracy,
    late_reason,
    file: file,
    localTime: simulated_time,
    address: simulated_address,
    timezone: "Simulated Timezone",
    ip: req.clientIp || req.ip,
    user_agent: "Simulation/" + req.get('User-Agent'),
    event_source: "SIMULATION"
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

  res.json({ ...result, _simulation: true });
});

/**
 * POST /attendance/simulate/timeout
 * DEVELOPMENT ONLY - Simulate check-out with custom timestamp
 */
export const simulateTimeOut = catchAsync(async (req, res) => {
  // DEVELOPMENT ONLY
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ ok: false, message: "Not Found" });
  }

  let target_user_id = req.user.user_id;
  if (req.body.user_id && req.user.user_type === "admin") {
    target_user_id = req.body.user_id;
  }

  const {
    latitude = 0,
    longitude = 0,
    accuracy = 10,
    simulated_time,
    simulated_address = "Simulated Location"
  } = req.body;

  const file = req.file;

  if (!simulated_time) {
    return res.status(400).json({ ok: false, message: "simulated_time (ISO format) is required" });
  }

  const result = await AttendanceService.processTimeOut({
    user_id: target_user_id,
    org_id: req.user.org_id,
    latitude,
    longitude,
    accuracy,
    file: file,
    localTime: simulated_time,
    address: simulated_address,
    timezone: "Simulated Timezone",
    ip: req.clientIp || req.ip,
    user_agent: "Simulation/" + req.get('User-Agent'),
    event_source: "SIMULATION"
  });

  if (!result.ok) {
    return res.status(result.status || 400).json(result);
  }

  res.json({ ...result, _simulation: true });
});

/**
 * GET /attendance/records/admin
 * Admin endpoint to fetch attendance records with filters
 */
export const getAdminRecords = catchAsync(async (req, res) => {
  if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
    return res.status(403).json({ ok: false, message: "Access denied" });
  }

  const { user_id, date_from, date_to, limit = 50 } = req.query;
  const org_id = req.user.org_id;

  const records = await AttendanceService.fetchAdminRecords({
    org_id,
    user_id,
    date_from,
    date_to,
    limit
  });

  res.json({ ok: true, data: records });
});

/**
 * GET /attendance/records
 * User endpoint to fetch their own attendance records
 */
export const getUserRecords = catchAsync(async (req, res) => {
  const userId = req.user.user_id;
  const { date_from, date_to, limit = 50 } = req.query;

  const records = await AttendanceService.fetchUserRecords({
    user_id: userId,
    date_from,
    date_to,
    limit
  });

  res.json({ ok: true, data: records });
});

/**
 * POST /attendance/correction-request
 * Submit a correction request for attendance
 */
export const submitCorrectionRequest = catchAsync(async (req, res) => {
  const {
    correction_type,
    request_date,
    reason,
    original_data,
    proposed_data
  } = req.body;

  const user_id = req.user.user_id;
  const org_id = req.user.org_id;

  if (!correction_type || !request_date || !reason) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!proposed_data || !Array.isArray(proposed_data) || proposed_data.length === 0) {
    return res.status(400).json({ error: "proposed_data (sessions array) is required" });
  }

  const id = await AttendanceService.createCorrectionRequest({
    org_id,
    user_id,
    correction_type,
    request_date,
    original_data,
    proposed_data,
    reason
  });

  res.status(201).json({
    message: "Correction request submitted",
    acr_id: id
  });
});

/**
 * GET /attendance/correction-requests
 * Fetch correction requests with filters
 */
export const getCorrectionRequests = catchAsync(async (req, res) => {
  const { status, date, month, year, page = 1, limit = 10 } = req.query;
  const org_id = req.user.org_id;
  const user_id = req.user.user_id;
  const user_type = req.user.user_type;

  const result = await AttendanceService.fetchCorrectionRequests({
    org_id,
    user_id,
    user_type,
    status,
    date,
    month,
    year,
    page,
    limit
  });

  res.json(result);
});

/**
 * GET /attendance/correction-request/:acr_id
 * Fetch single correction request details
 */
export const getCorrectionRequestById = catchAsync(async (req, res) => {
  const { acr_id } = req.params;
  const org_id = req.user.org_id;
  const user_id = req.user.user_id;
  const role = req.user.user_type;

  const correction = await AttendanceService.fetchCorrectionRequestById({
    acr_id,
    org_id,
    user_id,
    role
  });

  if (!correction) {
    return res.status(404).json({ error: "Request not found" });
  }

  res.json(correction);
});

/**
 * PATCH /attendance/correct-request/:acr_id
 * Admin endpoint to approve/reject correction request
 */
export const reviewCorrectionRequest = catchAsync(async (req, res) => {
  const { acr_id } = req.params;
  const { status, review_comments, sessions } = req.body;

  const org_id = req.user.org_id;
  const reviewer_id = req.user.user_id;
  const role = req.user.user_type;

  if (role !== "admin") {
    return res.status(403).json({ error: "Access denied" });
  }

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    await AttendanceService.reviewCorrectionRequest({
      acr_id,
      org_id,
      reviewer_id,
      status,
      review_comments,
      adminOverrideSessions: sessions
    });

    res.json({ message: `Request ${status} successfully` });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
});

/**
 * GET /attendance/records/export
 * Export user's attendance records for a month as Excel
 */
export const exportRecords = catchAsync(async (req, res) => {
  const { month } = req.query;
  const user_id = req.user.user_id;
  const org_id = req.user.org_id;
  const user_name = req.user.user_name;

  if (!month) {
    return res.status(400).json({ ok: false, message: "Month (YYYY-MM) is required" });
  }

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);

  if (isNaN(year) || isNaN(monthNum)) {
    return res.status(400).json({ ok: false, message: "Invalid month format. Use YYYY-MM." });
  }

  const workbook = await AttendanceService.exportRecordsToExcel({
    user_id,
    org_id,
    month,
    year,
    monthNum
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=Attendance_${month}_${user_name.replace(/\s+/g, '_')}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});
