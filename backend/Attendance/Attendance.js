import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import catchAsync from "../utils/catchAsync.js";
import { knexDB } from "../database.js";
import { authenticateJWT } from '../middleware/auth.js';
import { fetchTimeStamp, coordsToAddress } from "../Google_API/Maps.js";
import { getFileUrl } from "../s3/s3Service.js";
import { getEventSource } from "../utils/clientInfo.js";
import { AttendanceService } from "./AttendanceService.js";

const router = express.Router();
const upload = multer(); // store files in memory


// Helper: Fetch User Shift (Moved to Service, but checking if still needed here)
// It is not needed here if we delegate to Service.

// POST /attendance/checkin
router.post("/timein", authenticateJWT, upload.single("image"),
  catchAsync(async (req, res) => {
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
    let address = "Unknown Location"

    try {
      if (!isNaN(latitude) && !isNaN(longitude)) {
        tz = await fetchTimeStamp(latitude, longitude, nowUTC);
        const addrRes = await coordsToAddress(latitude, longitude);
        address = addrRes.address;
      }
    } catch (e) {
      console.error("Maps API Error:", e);
      // Fallback? Or fail? Originally it would fail if await failed.
      // Assuming we proceed or error out. 
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
      ip: req.ip,
      user_agent: req.get('User-Agent'),
      event_source: getEventSource(req)
    });

    if (!result.ok) {
      return res.status(result.status || 400).json(result);
    }

    return res.json(result);
  })
);


// POST /attendance/checkout
router.post("/timeout", authenticateJWT, upload.single("image"),
  catchAsync(async (req, res) => {
    // 1. DATA PREPARATION
    const { user_id, org_id } = req.user;
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const accuracy = Number(req.body.accuracy);
    const file = req.file;

    // 2. CONTEXT LOADING
    const nowUTC = new Date().toISOString();
    let tz = { localTime: nowUTC, tzName: "UTC" };
    let address = "Unknown Location"

    try {
      if (!isNaN(latitude) && !isNaN(longitude)) {
        tz = await fetchTimeStamp(latitude, longitude, nowUTC);
        const addrRes = await coordsToAddress(latitude, longitude);
        address = addrRes.address;
      }
    } catch (e) { console.error("Maps API Error", e); }

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
      ip: req.ip,
      user_agent: req.get('User-Agent'),
      event_source: getEventSource(req)
    });

    if (!result.ok) {
      return res.status(result.status || 400).json(result);
    }

    return res.json(result);
  })
);


// --- SIMULATION ENDPOINTS ---


// POST /attendance/simulate/timein
router.post("/simulate/timein", authenticateJWT, upload.single("image"),
  catchAsync(async (req, res) => {
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
      simulated_time, // ISO String expected
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
      file: file, // Pass the file from simulation
      localTime: simulated_time,
      address: simulated_address,
      timezone: "Simulated Timezone",
      ip: req.ip,
      user_agent: "Simulation/" + req.get('User-Agent'),
      event_source: "SIMULATION"
    });

    if (!result.ok) {
      return res.status(result.status || 400).json(result);
    }

    res.json({ ...result, _simulation: true });
  })
);


// POST /attendance/simulate/timeout
router.post("/simulate/timeout", authenticateJWT, upload.single("image"),
  catchAsync(async (req, res) => {
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
      file: file, // Pass the file from simulation
      localTime: simulated_time,
      address: simulated_address,
      timezone: "Simulated Timezone",
      ip: req.ip,
      user_agent: "Simulation/" + req.get('User-Agent'),
      event_source: "SIMULATION"
    });

    if (!result.ok) {
      return res.status(result.status || 400).json(result);
    }

    res.json({ ...result, _simulation: true });
  })
);


// Admin attendance records and images with admin role check
router.get("/records/admin", authenticateJWT, catchAsync(async (req, res) => {
  // try removed
  if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
    return res.status(403).json({ ok: false, message: "Access denied" });
  }

  const { user_id, date_from, date_to, limit = 50 } = req.query;

  let query = knexDB("attendance_records")
    .join("users", "attendance_records.user_id", "users.user_id")
    .leftJoin("designations", "users.desg_id", "designations.desg_id")
    .select(
      "attendance_records.*",
      knexDB.raw("DATE_FORMAT(attendance_records.time_in, '%Y-%m-%dT%H:%i:%s') as time_in_ts"),
      knexDB.raw("DATE_FORMAT(attendance_records.time_out, '%Y-%m-%dT%H:%i:%s') as time_out_ts"),
      knexDB.raw("DATE_FORMAT(attendance_records.created_at, '%Y-%m-%dT%H:%i:%s') as created_at_ts"),
      knexDB.raw("DATE_FORMAT(attendance_records.updated_at, '%Y-%m-%dT%H:%i:%s') as updated_at_ts"),
      "users.user_name",
      "users.email",
      "designations.desg_name as designation"
    )
    .orderBy("time_in", "desc")
    .limit(Math.min(parseInt(limit), 100));

  if (user_id) query = query.where("attendance_records.user_id", user_id);
  query = query.where("attendance_records.org_id", req.user.org_id);
  if (date_from) query = query.whereRaw("DATE(time_in) >= DATE(?)", [date_from]);
  if (date_to) query = query.whereRaw("DATE(time_in) <= DATE(?)", [date_to]);

  const records = await query;

  const withUrls = await Promise.all(
    records.map(async (row) => {
      let timeInUrl = null;
      let timeOutUrl = null;

      if (row.time_in_image_key) {
        const { url } = await getFileUrl({ key: row.time_in_image_key });
        timeInUrl = url;
      }
      if (row.time_in_image_key) {
        const { url } = await getFileUrl({ key: row.time_out_image_key });
        timeOutUrl = url;
      }

      // Use the formatted string (naive time) if available, otherwise fallback
      const time_in = row.time_in_ts || (row.time_in ? String(row.time_in) : null);
      const time_out = row.time_out_ts || (row.time_out ? String(row.time_out) : null);
      const created_at = row.created_at_ts || (row.created_at ? String(row.created_at) : null);
      const updated_at = row.updated_at_ts || (row.updated_at ? String(row.updated_at) : null);

      return {
        ...row,
        time_in,
        time_out,
        created_at,
        updated_at,
        time_in_image: timeInUrl,
        time_out_image: timeOutUrl,
      };
    })
  );

  res.json({ ok: true, data: withUrls });
}));


// Normal user fetch their own records with optional limit and date filter
router.get("/records", authenticateJWT, catchAsync(async (req, res) => {
  const userId = req.user.user_id;
  const { date_from, date_to, limit = 50 } = req.query;

  let query = knexDB("attendance_records")
    .where("user_id", userId)
    .select(
      "attendance_records.*",
      knexDB.raw("DATE_FORMAT(attendance_records.time_in, '%Y-%m-%dT%H:%i:%s') as time_in_ts"),
      knexDB.raw("DATE_FORMAT(attendance_records.time_out, '%Y-%m-%dT%H:%i:%s') as time_out_ts"),
      knexDB.raw("DATE_FORMAT(attendance_records.created_at, '%Y-%m-%dT%H:%i:%s') as created_at_ts"),
      knexDB.raw("DATE_FORMAT(attendance_records.updated_at, '%Y-%m-%dT%H:%i:%s') as updated_at_ts")
    )
    .orderBy("time_in", "desc")
    .limit(Math.min(parseInt(limit), 100)); // max limit 100

  if (date_from) {
    query = query.whereRaw("DATE(time_in) >= DATE(?)", [date_from]);
  }
  if (date_to) {
    query = query.whereRaw("DATE(time_in) <= DATE(?)", [date_to]);
  }

  const records = await query;

  const withUrls = await Promise.all(
    (records || []).map(async (row) => {
      let timeInUrl = null;
      let timeOutUrl = null;

      if (row.time_in_image_key) {
        const { url } = await getFileUrl({ key: row.time_in_image_key });
        timeInUrl = url;
      }
      if (row.time_out_image_key) {
        const { url } = await getFileUrl({ key: row.time_out_image_key });
        timeOutUrl = url;
      }

      const time_in = row.time_in_ts || (row.time_in ? String(row.time_in) : null);
      const time_out = row.time_out_ts || (row.time_out ? String(row.time_out) : null);
      const created_at = row.created_at_ts || (row.created_at ? String(row.created_at) : null);
      const updated_at = row.updated_at_ts || (row.updated_at ? String(row.updated_at) : null);

      return {
        ...row,
        time_in,
        time_out,
        created_at,
        updated_at,
        time_in_image: timeInUrl,
        time_out_image: timeOutUrl,
      };
    })
  );

  res.json({ ok: true, data: withUrls });
}));


router.post("/correction-request", authenticateJWT, catchAsync(async (req, res) => {
  const {
    correction_type,
    request_date,
    requested_time_in,
    requested_time_out,
    reason,
    correction_method, // 'fix', 'add_session', 'reset'
    sessions // Array for add_session
  } = req.body;

  const user_id = req.user.user_id;
  const org_id = req.user.org_id;

  if (!correction_type || !request_date || !reason) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Prepare metadata
  const validMethods = ['fix', 'add_session', 'reset'];
  const method = validMethods.includes(correction_method) ? correction_method : 'fix';

  let sessionsJson = null;
  if (method === 'add_session') {
    if (sessions && Array.isArray(sessions)) {
      sessionsJson = JSON.stringify(sessions);
    }
  }

  const [id] = await knexDB("attendance_correction_requests").insert({
    org_id,
    user_id,
    correction_type,
    request_date,
    // Combine date component with time component for DATETIME columns
    requested_time_in: requested_time_in ? `${request_date} ${(requested_time_in.length === 5 ? requested_time_in + ':00' : requested_time_in)}` : null,
    requested_time_out: requested_time_out ? `${request_date} ${(requested_time_out.length === 5 ? requested_time_out + ':00' : requested_time_out)}` : null,
    reason,
    status: "pending",
    correction_method: method,
    requested_sessions: sessionsJson,
    audit_trail: JSON.stringify([
      { action: "submitted", by: user_id, at: new Date() }
    ])
  });

  res.status(201).json({
    message: "Correction request submitted",
    acr_id: id
  });

}));


router.get("/correction-requests", authenticateJWT, catchAsync(async (req, res) => {
  const { status, date, month, year, page = 1, limit = 10 } = req.query;
  const org_id = req.user.org_id;
  const user_id = req.user.user_id;
  const user_type = req.user.user_type;

  const offset = (page - 1) * limit;

  const data = await knexDB("attendance_correction_requests as acr")
    .join("users as u", "u.user_id", "acr.user_id")
    .where("acr.org_id", org_id)
    .modify(qb => {
      if (user_type !== "admin") qb.where("acr.user_id", user_id);
      if (status) qb.where("acr.status", status);
      if (date) qb.where("acr.request_date", date);
      if (month) qb.whereRaw('MONTH(acr.request_date) = ?', [month]);
      if (year) qb.whereRaw('YEAR(acr.request_date) = ?', [year]);
    })
    .select(
      "acr.acr_id",
      "acr.correction_type",
      "acr.request_date",
      knexDB.raw("DATE_FORMAT(acr.requested_time_in, '%H:%i:%s') as requested_time_in"),
      knexDB.raw("DATE_FORMAT(acr.requested_time_out, '%H:%i:%s') as requested_time_out"),
      "acr.status",
      "acr.submitted_at",
      "u.user_id",
      "u.user_name",
      "u.desg_id"
    )
    .orderBy("acr.submitted_at", "desc")
    .limit(limit)
    .offset(offset);

  const countResult = await knexDB("attendance_correction_requests")
    .where("org_id", org_id)
    .modify(qb => {
      if (user_type !== "admin") qb.where("user_id", user_id);
      if (status) qb.where("status", status);
      if (date) qb.where("request_date", date);
      if (month) qb.whereRaw('MONTH(request_date) = ?', [month]);
      if (year) qb.whereRaw('YEAR(request_date) = ?', [year]);
    })
    .count("* as total")
    .first();

  res.json({
    data,
    count: Number(countResult.total)
  });

}));


router.get("/correction-request/:acr_id", authenticateJWT, catchAsync(async (req, res) => {
  const { acr_id } = req.params;
  const org_id = req.user.org_id;
  const user_id = req.user.user_id;
  const role = req.user.user_type;

  let query = knexDB("attendance_correction_requests as acr")
    .join("users as u", "u.user_id", "acr.user_id")
    .leftJoin("designations as d", "d.desg_id", "u.desg_id")
    .select(
      "acr.acr_id",
      "acr.correction_type",
      "acr.request_date",
      // Force return time only string to avoid timezone shifts
      knexDB.raw("DATE_FORMAT(acr.requested_time_in, '%H:%i:%s') as requested_time_in"),
      knexDB.raw("DATE_FORMAT(acr.requested_time_out, '%H:%i:%s') as requested_time_out"),
      "acr.reason",
      "acr.status",
      "acr.reviewed_by",
      "acr.reviewed_at",
      "acr.review_comments",
      "acr.audit_trail",
      "acr.submitted_at",
      "u.user_id",
      "u.user_name",
      "d.desg_name as designation",
      "acr.correction_method",
      "acr.requested_sessions"
    )
    .where("acr.acr_id", acr_id)
    .andWhere("acr.org_id", org_id);

  // 🔐 Access control
  if (role !== "admin") {
    query.andWhere("acr.user_id", user_id);
  }

  const correction = await query.first();

  if (!correction) {
    return res.status(404).json({ error: "Request not found" });
  }

  if (correction.audit_trail) {
    if (typeof correction.audit_trail === "string") {
      try {
        correction.audit_trail = JSON.parse(correction.audit_trail);
      } catch {
        correction.audit_trail = [];
      }
    }
  } else {
    correction.audit_trail = [];
  }

  res.json(correction);

})
);


router.patch("/correct-request/:acr_id", authenticateJWT, catchAsync(async (req, res) => {
  const { acr_id } = req.params;
  const { status, review_comments } = req.body;

  const org_id = req.user.org_id;
  const reviewer_id = req.user.user_id;
  const role = req.user.user_type;

  if (role !== "admin") {
    return res.status(403).json({ error: "Access denied" });
  }

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const correction = await knexDB("attendance_correction_requests")
    .where({ acr_id, org_id })
    .first();

  if (!correction) {
    return res.status(404).json({ error: "Request not found" });
  }

  let auditTrail = [];

  if (correction.audit_trail) {
    if (typeof correction.audit_trail === "string") {
      try {
        auditTrail = JSON.parse(correction.audit_trail);
      } catch {
        auditTrail = [];
      }
    } else {
      auditTrail = correction.audit_trail;
    }
  }

  auditTrail.push({
    action: status,
    by: reviewer_id,
    at: new Date(),
    comments: review_comments || null
  });

  await knexDB("attendance_correction_requests")
    .where({ acr_id, org_id })
    .update({
      status,
      reviewed_by: reviewer_id,
      reviewed_at: new Date(),
      review_comments: review_comments || null,
      audit_trail: JSON.stringify(auditTrail)
    });

  // --- APPLY CORRECTION IF APPROVED ---
  if (status === 'approved') {
    // Allow Date Override from Body
    const targetDate = req.body.request_date || correction.request_date;
    const dateStr = new Date(targetDate).toISOString().split('T')[0];

    // Use params from Body (Admin Override) OR DB (User Request)
    const correction_method = req.body.correction_method || correction.correction_method || 'fix';
    console.log("DEBUG: Correction Method:", correction_method);

    let sessions = req.body.sessions;
    if (!sessions && correction.requested_sessions) {
      try {
        console.log("DEBUG: Raw requested_sessions:", correction.requested_sessions);
        sessions = (typeof correction.requested_sessions === 'string')
          ? JSON.parse(correction.requested_sessions)
          : correction.requested_sessions;
      } catch (e) {
        console.error("DEBUG: JSON Parse Error", e);
        sessions = [];
      }
    }
    console.log("DEBUG: Final Sessions to Process:", sessions);

    const reset_time_in = req.body.reset_time_in || correction.requested_time_in;
    const reset_time_out = req.body.reset_time_out || correction.requested_time_out;

    const manualUpdateBase = {
      status: 'PRESENT',
      is_manual_adjustment: true,
      adjusted_by: reviewer_id,
      updated_at: knexDB.fn.now()
    };

    // 1. FIX (Standard Correction)
    if (correction_method === 'fix') {
      const updateData = {
        ...manualUpdateBase,
        adjustment_reason: `Correction Request #${acr_id} Approved`
      };

      // Use Override OR Original Request
      const finalIn = req.body.requested_time_in || correction.requested_time_in;
      const finalOut = req.body.requested_time_out || correction.requested_time_out;

      if (finalIn) updateData.first_in = finalIn;
      if (finalOut) updateData.last_out = finalOut;

      // Recalculate hours if we have both times
      if (finalIn && finalOut) {
        const start = new Date(`1970-01-01T${finalIn}`);
        const end = new Date(`1970-01-01T${finalOut}`);
        const diff = (end - start) / (1000 * 60 * 60);
        if (diff > 0) updateData.total_hours = diff.toFixed(2);
      }

      // Apply to Daily Attendance
      const existing = await knexDB("daily_attendance")
        .where({ user_id: correction.user_id, date: dateStr })
        .first();

      if (existing) {
        await knexDB("daily_attendance").where({ daily_id: existing.daily_id }).update(updateData);
      } else {
        await knexDB("daily_attendance").insert({
          user_id: correction.user_id,
          org_id,
          date: dateStr,
          ...updateData,
          created_at: knexDB.fn.now()
        });
      }
    }

    // 2. ADD SESSION (Add records + Sync)
    else if (correction_method === 'add_session') {
      if (sessions && Array.isArray(sessions) && sessions.length > 0) {
        const newRecords = sessions.map(s => ({
          user_id: correction.user_id,
          org_id,
          time_in: `${dateStr} ${(s.time_in.length === 5 ? s.time_in + ':00' : s.time_in)}`,
          time_out: `${dateStr} ${(s.time_out.length === 5 ? s.time_out + ':00' : s.time_out)}`,
          status: 'CLOSED',
          created_at: knexDB.fn.now(),
          updated_at: knexDB.fn.now(),
          time_in_address: 'Manual Addition',
          time_out_address: 'Manual Addition'
        }));

        await knexDB("attendance_records").insert(newRecords);

        // Sync Daily Attendance
        await AttendanceService.syncDailyAttendance(correction.user_id, dateStr, {
          ...manualUpdateBase,
          adjustment_reason: `Correction Request #${acr_id} (Sessions Added)`
        });
      }
    }

    // 3. RESET DAY (Delete + Single Session + Sync)
    else if (correction_method === 'reset') {
      // Delete all records for the day
      await knexDB("attendance_records")
        .where({ user_id: correction.user_id })
        .whereRaw("DATE(time_in) = ?", [dateStr])
        .del();

      // Insert Single Session
      const tIn = reset_time_in || correction.requested_time_in;
      const tOut = reset_time_out || correction.requested_time_out;

      if (tIn && tOut) {
        await knexDB("attendance_records").insert({
          user_id: correction.user_id,
          org_id,
          time_in: `${dateStr}T${tIn}`,
          time_out: `${dateStr}T${tOut}`,
          status: 'CLOSED',
          created_at: knexDB.fn.now(),
          updated_at: knexDB.fn.now(),
          time_in_address: 'Manual Reset',
          time_out_address: 'Manual Reset'
        });

        await AttendanceService.syncDailyAttendance(correction.user_id, dateStr, {
          ...manualUpdateBase,
          adjustment_reason: `Correction Request #${acr_id} (Day Reset)`
        });
      }
    }
  }
  // --------------------------------------

  res.json({
    message: `Request ${status} successfully`
  });

})
);


router.get("/records/export", authenticateJWT, catchAsync(async (req, res) => {
  const { month } = req.query;
  const user_id = req.user.user_id;
  const org_id = req.user.org_id;

  if (!month) {
    return res.status(400).json({ ok: false, message: "Month (YYYY-MM) is required" });
  }

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);

  if (isNaN(year) || isNaN(monthNum)) {
    return res.status(400).json({ ok: false, message: "Invalid month format. Use YYYY-MM." });
  }

  const startDate = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`;

  const records = await knexDB("attendance_records")
    .where({ user_id, org_id })
    .whereRaw("DATE(time_in) >= ?", [startDate])
    .whereRaw("DATE(time_in) <= ?", [endDate])
    .orderBy("time_in", "asc");

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("My Attendance");

  worksheet.columns = [

    { header: "Date", key: "date", width: 12 },
    { header: "Time In", key: "time_in", width: 15 },
    { header: "Time Out", key: "time_out", width: 15 },
    { header: "Total Hours", key: "total_hours", width: 12 },
    { header: "Status", key: "status", width: 15 },
    { header: "Late (Mins)", key: "late_minutes", width: 12 },
    { header: "Location (In)", key: "location", width: 40 },
    { header: "Location (Out)", key: "location_out", width: 40 }
  ];

  records.forEach(r => {
    let duration = "0.00";
    if (r.time_in && r.time_out) {
      const diffMs = new Date(r.time_out) - new Date(r.time_in);
      if (diffMs > 0) duration = (diffMs / (1000 * 60 * 60)).toFixed(2);
    }

    worksheet.addRow({
      date: new Date(r.time_in).toLocaleDateString(),
      time_in: r.time_in ? new Date(r.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
      time_out: r.time_out ? new Date(r.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
      total_hours: duration,
      status: r.late_minutes > 0 ? "Late" : "On Time",
      late_minutes: r.late_minutes || 0,
      location: r.time_in_address || "-",
      location_out: r.time_out_address || "-"
    });
  });

  // Style Header
  worksheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=Attendance_${month}_${req.user.user_name.replace(/\s+/g, '_')}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}));

export default router;
