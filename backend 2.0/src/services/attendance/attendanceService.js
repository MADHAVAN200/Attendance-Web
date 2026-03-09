import ExcelJS from "exceljs";
import { attendanceDB } from "../../config/database.js";
import * as S3Service from "../s3/s3Service.js";
import EventBus from "../../utils/EventBus.js";
import { PolicyService } from "../../../../backend/Attendance/PolicyEngine.js";

// ========== HELPER FUNCTIONS ==========

/**
 * Fetch User Shift
 */
async function getUserShift(user_id) {
  const user = await attendanceDB("users")
    .join("shifts", "users.shift_id", "shifts.shift_id")
    .where("users.user_id", user_id)
    .select("shifts.*")
    .first();
  return user;
}

// ========== TIME IN/OUT PROCESSING ==========

/**
 * Process Time In
 * context: { user_id, org_id, latitude, longitude, accuracy, late_reason, file, localTime, address, ip, user_agent, timezone, event_source }
 */
export async function processTimeIn(context) {
  const {
    user_id,
    org_id,
    latitude,
    longitude,
    accuracy,
    late_reason,
    file,
    localTime,
    address,
    ip,
    user_agent
  } = context;

  // 1. Check Existing Session
  const openSession = await attendanceDB("attendance_records")
    .where({ user_id })
    .whereNull("time_out")
    .whereRaw("time_in >= DATE_SUB(?, INTERVAL 12 HOUR)", [localTime])
    .first();

  if (openSession) {
    return { ok: false, status: 400, message: "Already timed in. Please time out first." };
  }

  // 2. Policy Context
  const sessionContext = await PolicyService.buildSessionContext(user_id, localTime, "time_in");
  const shift = await getUserShift(user_id);
  const rules = PolicyService.getRulesFromShift(shift);

  // 3. Modular Policy Checks

  // A. Geolocation Check
  const geoCheck = await PolicyService.checkLocationCompliance(user_id, latitude, longitude, accuracy, rules.entry_requirements);
  if (!geoCheck.ok) {
    return { ok: false, status: 400, message: "Policy Violation: " + geoCheck.error };
  }

  // B. Biometric Check
  const bioCheck = PolicyService.checkBiometricCompliance(file, rules.entry_requirements);
  if (!bioCheck.ok) {
    return { ok: false, status: 400, message: "Policy Violation: " + bioCheck.error };
  }

  // 4. Policy Execution (Late Calculation)
  let lateCheck = { minutesLate: 0, isLate: false, gracePeriod: 0 };

  if (sessionContext.is_first_session) {
    lateCheck = PolicyService.calculateLateArrival(localTime, rules);
  }

  const minutesLate = lateCheck.minutesLate;

  // VALIDATION: Late Reason Compulsory
  if (lateCheck.isLate && !late_reason) {
    return {
      ok: false,
      status: 400,
      message: `You are ${minutesLate} minutes late. Please provide a reason to check in.`
    };
  }

  // Metadata
  const metadata = {
    time_in: {
      accuracy: Math.round(accuracy),
      ip_address: ip,
      user_agent: user_agent,
      timestamp_utc: new Date().toISOString(),
      timezone: context.timezone || "N/A"
    },
    session_context: sessionContext
  };

  // DB Insert
  const [attendance_id] = await attendanceDB("attendance_records").insert({
    user_id,
    org_id,
    late_reason: sessionContext.is_first_session ? (late_reason || (lateCheck.isLate ? "Late Entry" : null)) : null,
    late_minutes: minutesLate,
    time_in: localTime,
    time_in_lat: latitude,
    time_in_lng: longitude,
    time_in_address: address,
    status: "PRESENT",
    metadata: JSON.stringify(metadata),
    created_at: attendanceDB.fn.now(),
    updated_at: attendanceDB.fn.now(),
  });

  // Daily Sync
  try {
    const dateStr = localTime.split('T')[0];
    await syncDailyAttendance(user_id, dateStr);
  } catch (dailyErr) {
    console.error("Daily Sync Error:", dailyErr);
  }

  // S3 Upload
  let imageKey = null;
  if (file) {
    const uploadResult = await S3Service.uploadCompressedImage({
      fileBuffer: file.buffer,
      key: `${attendance_id}_in`,
      directory: "attendance_images"
    });
    imageKey = uploadResult.key;
    await attendanceDB("attendance_records")
      .where({ attendance_id })
      .update({
        time_in_image_key: imageKey,
        updated_at: attendanceDB.fn.now(),
      });
  }

  // Events
  EventBus.emitNotification({
    org_id,
    user_id,
    title: "Attendance Checked In",
    message: `You have successfully checked in at ${localTime} from ${address}`,
    type: "SUCCESS",
    related_entity_type: "ATTENDANCE",
    related_entity_id: attendance_id
  });

  EventBus.emitActivityLog({
    user_id,
    org_id,
    event_type: "CHECK_IN",
    event_source: context.event_source || "WEB",
    object_type: "ATTENDANCE",
    object_id: attendance_id,
    description: `User checked in at ${address} (Session #${sessionContext.session_number})`,
    location: `${latitude},${longitude}`,
    request_ip: ip,
    user_agent: user_agent
  });

  return {
    ok: true,
    attendance_id,
    local_time: localTime,
    address,
    tz_name: context.timezone,
    image_key: imageKey,
    session_number: sessionContext.session_number,
    is_first_session: sessionContext.is_first_session,
    message: "Timed in successfully",
  };
}

/**
 * Process Time Out
 * context: { user_id, org_id, latitude, longitude, accuracy, file, localTime, address, ip, user_agent, timezone, event_source }
 */
export async function processTimeOut(context) {
  const {
    user_id,
    org_id,
    latitude,
    longitude,
    accuracy,
    file,
    localTime,
    address,
    ip,
    user_agent
  } = context;

  // 1. Check Existing Session
  const openSession = await attendanceDB("attendance_records")
    .where({ user_id })
    .whereNull("time_out")
    .whereRaw("time_in >= DATE_SUB(?, INTERVAL 12 HOUR)", [localTime])
    .orderBy("time_in", "desc")
    .first();

  if (!openSession) {
    return { ok: false, status: 400, message: "No active time-in found to time out." };
  }

  // 2. Policy Context
  const sessionContext = await PolicyService.buildSessionContext(user_id, localTime, "time_out");
  const shift = await getUserShift(user_id);
  const rules = PolicyService.getRulesFromShift(shift);

  // 3. Modular Policy Checks

  // A. Geolocation Check
  const geoCheck = await PolicyService.checkLocationCompliance(user_id, latitude, longitude, accuracy, rules.exit_requirements);
  if (!geoCheck.ok) {
    return { ok: false, status: 400, message: "Policy Violation: " + geoCheck.error };
  }

  // B. Biometric Check
  const bioCheck = PolicyService.checkBiometricCompliance(file, rules.exit_requirements);
  if (!bioCheck.ok) {
    return { ok: false, status: 400, message: "Policy Violation: " + bioCheck.error };
  }

  // 4. S3 Upload
  let imageKey = null;
  if (file) {
    const uploadResult = await S3Service.uploadCompressedImage({
      fileBuffer: file.buffer,
      key: `${openSession.attendance_id}_out`,
      directory: "attendance_images"
    });
    imageKey = uploadResult.key;
    await attendanceDB("attendance_records")
      .where({ attendance_id: openSession.attendance_id })
      .update({
        time_out_image_key: imageKey,
        updated_at: attendanceDB.fn.now(),
      });
  }

  // Calculations
  const timeIn = new Date(openSession.time_in);
  const timeOut = new Date(localTime);
  const durationMs = timeOut - timeIn;
  const totalHours = durationMs / (1000 * 60 * 60);
  const minutesLate = openSession.late_minutes || 0;

  // Status Evaluation
  const status = openSession.status === "LATE_NOT_PUNCHED_OUT" ? "LATE" : "PRESENT";

  // Metadata Update
  let metadata = {};
  try {
    if (typeof openSession.metadata === 'string') {
      metadata = JSON.parse(openSession.metadata);
    } else if (typeof openSession.metadata === 'object' && openSession.metadata !== null) {
      metadata = openSession.metadata;
    }
  } catch (e) {
    console.error("Metadata parse error", e);
  }

  metadata.time_out = {
    accuracy: Math.round(accuracy),
    ip_address: ip,
    user_agent: user_agent,
    timestamp_utc: new Date().toISOString(),
    timezone: context.timezone || "N/A",
    total_hours: parseFloat(totalHours.toFixed(2))
  };
  metadata.session_context_at_checkout = sessionContext;

  // DB Update
  await attendanceDB("attendance_records")
    .where({ attendance_id: openSession.attendance_id })
    .update({
      time_out: localTime,
      time_out_lat: latitude,
      time_out_lng: longitude,
      time_out_address: address,
      overtime_hours: totalHours > (rules.overtime?.threshold || 8) ? (totalHours - (rules.overtime?.threshold || 8)) : 0,
      status: "PRESENT",
      metadata: JSON.stringify(metadata),
      updated_at: attendanceDB.fn.now(),
    });

  // Daily Sync
  try {
    const dateStrSync = localTime.split('T')[0];
    await syncDailyAttendance(user_id, dateStrSync, { status });
  } catch (dailyErr) {
    console.error("Daily Sync Error (Timeout):", dailyErr);
  }

  // Events
  EventBus.emitNotification({
    org_id,
    user_id,
    title: "Attendance Checked Out",
    message: `You have successfully checked out at ${localTime}. Total hours today: ${sessionContext.total_hours_today.toFixed(2)}h`,
    type: "INFO",
    related_entity_type: "ATTENDANCE",
    related_entity_id: openSession.attendance_id
  });

  EventBus.emitActivityLog({
    user_id,
    org_id,
    event_type: "CHECK_OUT",
    event_source: context.event_source || "WEB",
    object_type: "ATTENDANCE",
    object_id: openSession.attendance_id,
    description: `User checked out at ${address} (Status: ${status})`,
    location: `${latitude},${longitude}`,
    request_ip: ip,
    user_agent: user_agent
  });

  return {
    ok: true,
    attendance_id: openSession.attendance_id,
    local_time_out: localTime,
    address,
    tz_name: context.timezone,
    image_key: imageKey,
    status,
    session_hours: parseFloat(totalHours.toFixed(2)),
    total_hours_today: sessionContext.total_hours_today,
    message: "Timed out successfully",
  };
}

/**
 * Sync Daily Attendance
 * Re-calculates and updates daily_attendance based on current records
 */
export async function syncDailyAttendance(user_id, dateStr, overrides = {}) {
  try {
    // 1. Fetch all records for the day
    const records = await attendanceDB("attendance_records")
      .where({ user_id })
      .whereRaw("DATE(time_in) = ?", [dateStr])
      .orderBy("time_in", "asc");

    if (!records.length) return;

    const firstRec = records[0];
    const lastRec = records[records.length - 1];

    // 2. Ensure Daily Record Exists
    const existingDaily = await attendanceDB("daily_attendance")
      .where({ user_id, date: dateStr })
      .first();

    if (!existingDaily) {
      const shift = await getUserShift(user_id);

      await attendanceDB("daily_attendance").insert({
        user_id,
        org_id: records[0].org_id,
        date: dateStr,
        shift_id: shift ? shift.shift_id : null,
        status: 'PRESENT',
        created_at: attendanceDB.fn.now(),
        updated_at: attendanceDB.fn.now(),
        total_hours: 0
      });
    }

    // 3. Calculate Hours
    let totalMs = 0;
    records.forEach(r => {
      if (r.time_in && r.time_out) {
        totalMs += (new Date(r.time_out) - new Date(r.time_in));
      }
    });
    const totalHours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(2));

    // 4. Get Rules for Overtime
    let overtimeHours = 0;
    try {
      const shift = await getUserShift(user_id);
      const rules = PolicyService.getRulesFromShift(shift);
      const threshold = rules.overtime?.threshold || 8;
      if (totalHours > threshold) {
        overtimeHours = totalHours - threshold;
      }
    } catch (e) {
      // Ignore missing shift/policy errors during sync
    }

    const getTimeStr = (d) => {
      if (!d) return null;
      try {
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return null;
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
      } catch (e) {
        return null;
      }
    };

    const updateData = {
      first_in: getTimeStr(firstRec.time_in),
      last_out: getTimeStr(lastRec.time_out),
      total_hours: totalHours,
      overtime_hours: overtimeHours,
      updated_at: attendanceDB.fn.now(),
      ...overrides
    };

    await attendanceDB("daily_attendance")
      .where({ user_id, date: dateStr })
      .update(updateData);

  } catch (err) {
    console.error("Sync Daily Attendance Error:", err);
    throw err;
  }
}

// ========== RECORDS MANAGEMENT ==========

/**
 * Fetch attendance records for admin view with user details
 */
export async function fetchAdminRecords({ org_id, user_id, date_from, date_to, limit }) {
  let query = attendanceDB("attendance_records")
    .join("users", "attendance_records.user_id", "users.user_id")
    .leftJoin("designations", "users.desg_id", "designations.desg_id")
    .select(
      "attendance_records.*",
      attendanceDB.raw("DATE_FORMAT(attendance_records.time_in, '%Y-%m-%dT%H:%i:%s') as time_in_ts"),
      attendanceDB.raw("DATE_FORMAT(attendance_records.time_out, '%Y-%m-%dT%H:%i:%s') as time_out_ts"),
      attendanceDB.raw("DATE_FORMAT(attendance_records.created_at, '%Y-%m-%dT%H:%i:%s') as created_at_ts"),
      attendanceDB.raw("DATE_FORMAT(attendance_records.updated_at, '%Y-%m-%dT%H:%i:%s') as updated_at_ts"),
      "users.user_name",
      "users.email",
      "designations.desg_name as designation"
    )
    .orderBy("time_in", "desc")
    .limit(Math.min(parseInt(limit), 100));

  if (user_id) query = query.where("attendance_records.user_id", user_id);
  query = query.where("attendance_records.org_id", org_id);
  if (date_from) query = query.whereRaw("DATE(time_in) >= DATE(?)", [date_from]);
  if (date_to) query = query.whereRaw("DATE(time_in) <= DATE(?)", [date_to]);

  const records = await query;

  // Fetch pre-signed URLs for images
  const withUrls = await Promise.all(
    records.map(async (row) => {
      let timeInUrl = null;
      let timeOutUrl = null;

      if (row.time_in_image_key) {
        const { url } = await S3Service.getFileUrl({ key: row.time_in_image_key });
        timeInUrl = url;
      }
      if (row.time_out_image_key) {
        const { url } = await S3Service.getFileUrl({ key: row.time_out_image_key });
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

  return withUrls;
}

/**
 * Fetch attendance records for a specific user
 */
export async function fetchUserRecords({ user_id, date_from, date_to, limit }) {
  let query = attendanceDB("attendance_records")
    .where("user_id", user_id)
    .select(
      "attendance_records.*",
      attendanceDB.raw("DATE_FORMAT(attendance_records.time_in, '%Y-%m-%dT%H:%i:%s') as time_in_ts"),
      attendanceDB.raw("DATE_FORMAT(attendance_records.time_out, '%Y-%m-%dT%H:%i:%s') as time_out_ts"),
      attendanceDB.raw("DATE_FORMAT(attendance_records.created_at, '%Y-%m-%dT%H:%i:%s') as created_at_ts"),
      attendanceDB.raw("DATE_FORMAT(attendance_records.updated_at, '%Y-%m-%dT%H:%i:%s') as updated_at_ts")
    )
    .orderBy("time_in", "desc")
    .limit(Math.min(parseInt(limit), 100));

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
        const { url } = await S3Service.getFileUrl({ key: row.time_in_image_key });
        timeInUrl = url;
      }
      if (row.time_out_image_key) {
        const { url } = await S3Service.getFileUrl({ key: row.time_out_image_key });
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

  return withUrls;
}

// ========== CORRECTION REQUESTS ==========

/**
 * Create a new correction request
 * Enforces single request per day by deleting existing ones
 */
export async function createCorrectionRequest({
  org_id,
  user_id,
  correction_type,
  request_date,
  original_data,
  proposed_data,
  reason
}) {
  // ENFORCE SINGLE REQUEST PER DAY: Delete any existing request for this date
  await attendanceDB("attendance_correction_requests")
    .where({ user_id, org_id, request_date })
    .del();

  const [id] = await attendanceDB("attendance_correction_requests").insert({
    org_id,
    user_id,
    correction_type,
    request_date,
    original_data: JSON.stringify(original_data || []),
    proposed_data: JSON.stringify(proposed_data),
    reason,
    status: "pending",
    audit_trail: JSON.stringify([
      { action: "submitted", by: user_id, at: new Date() }
    ])
  });

  return id;
}

/**
 * Fetch correction requests with pagination and filters
 */
export async function fetchCorrectionRequests({
  org_id,
  user_id,
  user_type,
  status,
  date,
  month,
  year,
  page,
  limit
}) {
  const offset = (page - 1) * limit;

  const data = await attendanceDB("attendance_correction_requests as acr")
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
      "acr.original_data",
      "acr.proposed_data",
      "acr.status",
      "acr.reason",
      "acr.submitted_at",
      "u.user_id",
      "u.user_name",
      "u.desg_id"
    )
    .orderBy("acr.submitted_at", "desc")
    .limit(limit)
    .offset(offset);

  const countResult = await attendanceDB("attendance_correction_requests")
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

  return {
    data,
    count: Number(countResult.total)
  };
}

/**
 * Fetch a single correction request by ID
 */
export async function fetchCorrectionRequestById({ acr_id, org_id, user_id, role }) {
  let query = attendanceDB("attendance_correction_requests as acr")
    .join("users as u", "u.user_id", "acr.user_id")
    .leftJoin("designations as d", "d.desg_id", "u.desg_id")
    .select(
      "acr.acr_id",
      "acr.correction_type",
      "acr.request_date",
      "acr.original_data",
      "acr.proposed_data",
      "acr.reason",
      "acr.status",
      "acr.reviewed_by",
      "acr.reviewed_at",
      "acr.review_comments",
      "acr.audit_trail",
      "acr.submitted_at",
      "u.user_id",
      "u.user_name",
      "d.desg_name as designation"
    )
    .where("acr.acr_id", acr_id)
    .andWhere("acr.org_id", org_id);

  // Access control
  if (role !== "admin") {
    query.andWhere("acr.user_id", user_id);
  }

  const correction = await query.first();

  if (!correction) {
    return null;
  }

  // Parse JSON columns
  const jsonCols = ['audit_trail', 'original_data', 'proposed_data'];
  for (const col of jsonCols) {
    if (correction[col] && typeof correction[col] === 'string') {
      try {
        correction[col] = JSON.parse(correction[col]);
      } catch {
        correction[col] = col === 'audit_trail' ? [] : null;
      }
    } else if (!correction[col]) {
      correction[col] = col === 'audit_trail' ? [] : null;
    }
  }

  return correction;
}

/**
 * Review (approve/reject) a correction request
 * If approved, apply the corrections to attendance records
 */
export async function reviewCorrectionRequest({
  acr_id,
  org_id,
  reviewer_id,
  status,
  review_comments,
  adminOverrideSessions
}) {
  const correction = await attendanceDB("attendance_correction_requests")
    .where({ acr_id, org_id })
    .first();

  if (!correction) {
    throw { status: 404, message: "Request not found" };
  }

  // Parse audit_trail
  let auditTrail = [];
  if (correction.audit_trail) {
    try {
      auditTrail = typeof correction.audit_trail === 'string'
        ? JSON.parse(correction.audit_trail)
        : correction.audit_trail;
    } catch {
      auditTrail = [];
    }
  }

  auditTrail.push({
    action: status,
    by: reviewer_id,
    at: new Date(),
    comments: review_comments || null
  });

  // Determine the sessions to apply: admin override takes priority, else use proposed_data
  const adminOverride = adminOverrideSessions && Array.isArray(adminOverrideSessions) && adminOverrideSessions.length > 0
    ? adminOverrideSessions
    : null;

  // Parse stored proposed_data
  let proposedSessions = [];
  try {
    const raw = typeof correction.proposed_data === 'string'
      ? JSON.parse(correction.proposed_data)
      : correction.proposed_data;
    proposedSessions = Array.isArray(raw) ? raw : [];
  } catch {
    proposedSessions = [];
  }

  // Use admin override if provided, otherwise fall back to the stored proposal
  const sessionsToApply = adminOverride || proposedSessions;

  // If admin provided an override, update proposed_data in DB to reflect what was ACTUALLY applied
  let updatedProposedData = null;
  if (adminOverride) {
    updatedProposedData = JSON.stringify(adminOverride);
  }

  const dbUpdate = {
    status,
    reviewed_by: reviewer_id,
    reviewed_at: new Date(),
    review_comments: review_comments || null,
    audit_trail: JSON.stringify(auditTrail)
  };
  if (updatedProposedData) dbUpdate.proposed_data = updatedProposedData;

  await attendanceDB("attendance_correction_requests")
    .where({ acr_id, org_id })
    .update(dbUpdate);

  // --- APPLY CORRECTION IF APPROVED ---
  if (status === 'approved' && sessionsToApply.length > 0) {
    // Resolve final date string (YYYY-MM-DD)
    const targetDate = correction.request_date;
    const d = new Date(targetDate);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    const finalDateStr = localDate.toISOString().split('T')[0];

    // Delete all existing records for the day
    await attendanceDB("attendance_records")
      .where({ user_id: correction.user_id })
      .whereRaw("DATE(time_in) = ?", [finalDateStr])
      .del();

    // Insert the approved sessions
    const newRecords = sessionsToApply.map(s => {
      const tIn = typeof s.time_in === 'string' && s.time_in.length === 5 ? s.time_in + ':00' : s.time_in;
      const tOut = typeof s.time_out === 'string' && s.time_out.length === 5 ? s.time_out + ':00' : s.time_out;
      return {
        user_id: correction.user_id,
        org_id,
        time_in: `${finalDateStr} ${tIn}`,
        time_out: `${finalDateStr} ${tOut}`,
        status: 'CLOSED',
        created_at: attendanceDB.fn.now(),
        updated_at: attendanceDB.fn.now(),
        time_in_address: 'Manual Correction',
        time_out_address: 'Manual Correction',
        is_manual: true,
        altered_by: reviewer_id
      };
    });

    await attendanceDB("attendance_records").insert(newRecords);

    // Sync Daily Summary
    const manualBase = {
      status: 'PRESENT',
      is_manual_adjustment: true,
      adjusted_by: reviewer_id,
      updated_at: attendanceDB.fn.now()
    };

    await syncDailyAttendance(correction.user_id, finalDateStr, {
      ...manualBase,
      is_altered: true,
      adjustment_reason: `Correction Request #${acr_id}`
    });
  }
}

// ========== EXPORT ==========

/**
 * Export attendance records to Excel for a given month
 */
export async function exportRecordsToExcel({ user_id, org_id, month, year, monthNum }) {
  const startDate = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`;

  const records = await attendanceDB("attendance_records")
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

  return workbook;
}
