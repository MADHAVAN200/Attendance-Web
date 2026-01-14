import express from "express";
import { knexDB } from "../database.js";
import { authenticateJWT } from "../AuthAPI/LoginAPI.js";
import { fetchTimeStamp, coordsToAddress } from "../Google_API/Maps.js";
import multer from "multer";
import { uploadFile, getFileUrl, listFiles, uploadCompressedImage } from "../s3/s3Service.js";
import EventBus from "../utils/EventBus.js";
import { getEventSource } from "../utils/clientInfo.js";
import catchAsync from "../utils/catchAsync.js";
import { PolicyService } from "./PolicyEngine.js";
import { verifyUserGeofence } from "./Geofencing.js";

const router = express.Router();
const upload = multer(); // store files in memory

// Helper: Fetch User Shift
async function getUserShift(user_id) {
  const user = await knexDB("users")
    .join("shifts", "users.shift_id", "shifts.shift_id")
    .where("users.user_id", user_id)
    .select("shifts.*")
    .first();
  return user;
}

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


    // 2. CONTEXT LOADING
    // A. Time & Address
    const nowUTC = new Date().toISOString();
    const tz = await fetchTimeStamp(latitude, longitude, nowUTC);
    const localTime = tz.localTime;
    const { address } = await coordsToAddress(latitude, longitude);

    // B. Check Existing Session
    const openSession = await knexDB("attendance_records")
      .where({ user_id })
      .whereNull("time_out")
      .whereRaw("DATE(time_in) = DATE(?)", [localTime])
      .first();

    if (openSession) {
      return res.status(400).json({ ok: false, message: "Already timed in. Please time out first." });
    }

    // C. Policy Context
    const sessionContext = await PolicyService.buildSessionContext(user_id, localTime, "time_in");
    const shift = await getUserShift(user_id);
    const rules = PolicyService.getRulesFromShift(shift);

    // 3. MODULAR POLICY CHECKS

    // A. Geolocation Check
    const geoCheck = await PolicyService.checkLocationCompliance(user_id, latitude, longitude, accuracy, rules.entry_requirements);
    if (!geoCheck.ok) {
      return res.status(400).json({ ok: false, message: "Policy Violation: " + geoCheck.error });
    }

    // B. Biometric Check
    const bioCheck = PolicyService.checkBiometricCompliance(file, rules.entry_requirements);
    if (!bioCheck.ok) {
      return res.status(400).json({ ok: false, message: "Policy Violation: " + bioCheck.error });
    }

    // 4. POLICY EXECUTION

    // Late Calculation
    const lateCheck = PolicyService.calculateLateArrival(localTime, rules);
    const minutesLate = lateCheck.minutesLate;

    // Metadata
    const metadata = {
      time_in: {
        accuracy: Math.round(accuracy),
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        timestamp_utc: nowUTC,
        timezone: tz.tzName
      },
      session_context: sessionContext
    };

    // DB Insert
    const [attendance_id] = await knexDB("attendance_records").insert({
      user_id,
      org_id,
      late_reason: sessionContext.is_first_session ? (late_reason || (lateCheck.isLate ? "Late Entry" : null)) : null,
      late_minutes: minutesLate,
      time_in: localTime,
      time_in_lat: latitude,
      time_in_lng: longitude,
      time_in_address: address,
      status: lateCheck.isLate ? "LATE" : "TIMED_IN",
      metadata: JSON.stringify(metadata),
      created_at: knexDB.fn.now(),
      updated_at: knexDB.fn.now(),
    });

    // Daily Sync
    try {
      const dateStr = localTime.split('T')[0];
      const timeStr = localTime.split('T')[1].split('.')[0];

      const existingDaily = await knexDB("daily_attendance")
        .where({ user_id, date: dateStr })
        .first();

      if (!existingDaily) {
        await knexDB("daily_attendance").insert({
          user_id,
          org_id,
          date: dateStr,
          shift_id: shift ? shift.shift_id : null,
          first_in: timeStr,
          status: lateCheck.isLate ? 'LATE' : 'ON_TIME', // Set initial status based on arrival
          total_hours: 0,
          created_at: knexDB.fn.now(),
          updated_at: knexDB.fn.now()
        });
      }
    } catch (dailyErr) {
      console.error("Daily Sync Error:", dailyErr);
    }

    // S3 Upload
    let imageKey = null;
    if (file) {
      const uploadResult = await uploadCompressedImage({
        fileBuffer: file.buffer,
        key: `${attendance_id}_in`,
        directory: "attendance_images"
      });
      imageKey = uploadResult.key;
      await knexDB("attendance_records")
        .where({ attendance_id })
        .update({
          time_in_image_key: imageKey,
          updated_at: knexDB.fn.now(),
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
      event_source: getEventSource(req),
      object_type: "ATTENDANCE",
      object_id: attendance_id,
      description: `User checked in at ${address} (Session #${sessionContext.session_number})`,
      location: `${latitude},${longitude}`,
      request_ip: req.ip,
      user_agent: req.get('User-Agent')
    });

    return res.json({
      ok: true,
      attendance_id,
      local_time: localTime,
      address,
      tz_name: tz.tzName,
      image_key: imageKey,
      session_number: sessionContext.session_number,
      is_first_session: sessionContext.is_first_session,
      message: "Timed in successfully",
    });
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
    // A. Time & Address
    const nowUTC = new Date().toISOString();
    const tz = await fetchTimeStamp(latitude, longitude, nowUTC);
    const localTime = tz.localTime;
    const { address } = await coordsToAddress(latitude, longitude);

    // B. Check Existing Session (Fail Fast)
    const openSession = await knexDB("attendance_records")
      .where({ user_id })
      .whereNull("time_out")
      .whereRaw("DATE(time_in) = DATE(?)", [localTime])
      .first();
    // console.log("open session: ", openSession);
    // console.log("local time: ", localTime);

    if (!openSession) {
      return res.status(400).json({ ok: false, message: "No active time-in found to time out." });
    }

    // C. Policy Context
    const sessionContext = await PolicyService.buildSessionContext(user_id, localTime, "time_out");
    const shift = await getUserShift(user_id);
    const rules = PolicyService.getRulesFromShift(shift);

    // 3. MODULAR POLICY CHECKS (Fail Fast)

    // A. Geolocation Check
    const geoCheck = await PolicyService.checkLocationCompliance(user_id, latitude, longitude, accuracy, rules.exit_requirements);
    if (!geoCheck.ok) {
      return res.status(400).json({ ok: false, message: "Policy Violation: " + geoCheck.error });
    }

    // B. Biometric Check
    const bioCheck = PolicyService.checkBiometricCompliance(file, rules.exit_requirements);
    if (!bioCheck.ok) {
      return res.status(400).json({ ok: false, message: "Policy Violation: " + bioCheck.error });
    }

    // 4. POLICY EXECUTION

    // S3 Upload
    let imageKey = null;
    if (file) {
      const uploadResult = await uploadCompressedImage({
        fileBuffer: file.buffer,
        key: `${openSession.attendance_id}_out`,
        directory: "attendance_images"
      });
      imageKey = uploadResult.key;
      await knexDB("attendance_records")
        .where({ attendance_id: openSession.attendance_id })
        .update({
          time_out_image_key: imageKey,
          updated_at: knexDB.fn.now(),
        });
    }

    // Calculations
    const timeIn = new Date(openSession.time_in);
    const timeOut = new Date(nowUTC);
    const durationMs = timeOut - timeIn;
    const totalHours = durationMs / (1000 * 60 * 60);
    const minutesLate = openSession.late_minutes || 0;
    // console.log("timeIn", timeIn);
    // console.log("timeOut", timeOut);
    // console.log("durationMs", durationMs);
    // console.log("totalHours", totalHours);
    // console.log("minutesLate", minutesLate);

    // Status Evaluation
    const statusEvalData = {
      ...sessionContext,
      total_hours: totalHours,
      minutes_late: minutesLate,
      check_in_hour: timeIn.getHours(),
      check_out_hour: timeOut.getHours(),
      last_time_out_hour: timeOut.getHours()
    };
    const status = PolicyService.evaluateStatus(rules, statusEvalData);

    // Metadata Update
    let metadata = {};
    try {
      if (typeof openSession.metadata === 'string') {
        metadata = JSON.parse(openSession.metadata);
      } else if (typeof openSession.metadata === 'object' && openSession.metadata !== null) {
        metadata = openSession.metadata;
      }
    } catch (e) { console.error("Metadata parse error", e); }

    metadata.time_out = {
      accuracy: Math.round(accuracy),
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      timestamp_utc: nowUTC,
      timezone: tz.tzName,
      total_hours: parseFloat(totalHours.toFixed(2))
    };
    metadata.session_context_at_checkout = sessionContext;

    // DB Update
    await knexDB("attendance_records")
      .where({ attendance_id: openSession.attendance_id })
      .update({
        time_out: localTime,
        time_out_lat: latitude,
        time_out_lng: longitude,
        time_out_address: address,
        overtime_hours: totalHours > (rules.overtime?.threshold || 8) ? (totalHours - (rules.overtime?.threshold || 8)) : 0,
        metadata: JSON.stringify(metadata),
        updated_at: knexDB.fn.now(),
      });

    // Daily Sync
    try {
      const dateStrSync = localTime.split('T')[0];
      const timeStrSync = localTime.split('T')[1].split('.')[0];
      const grandTotalHours = parseFloat((sessionContext.total_hours_today + totalHours).toFixed(2));

      await knexDB("daily_attendance")
        .where({ user_id, date: dateStrSync })
        .update({
          last_out: timeStrSync,
          total_hours: grandTotalHours,
          status: status,
          updated_at: knexDB.fn.now()
        });
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
      event_source: getEventSource(req),
      object_type: "ATTENDANCE",
      object_id: openSession.attendance_id,
      description: `User checked out at ${address} (Status: ${status})`,
      location: `${latitude},${longitude}`,
      request_ip: req.ip,
      user_agent: req.get('User-Agent')
    });

    return res.json({
      ok: true,
      attendance_id: openSession.attendance_id,
      local_time_out: localTime,
      address,
      tz_name: tz.tzName,
      image_key: imageKey,
      status,
      session_hours: parseFloat(totalHours.toFixed(2)),
      total_hours_today: sessionContext.total_hours_today,
      message: "Timed out successfully",
    });
  })
);

// Admin attendance records and images with admin role check
router.get("/records/admin", authenticateJWT, catchAsync(async (req, res) => {
  // try removed
  if (req.user.user_type !== "admin" && req.user.user_type !== "HR") {
    return res.status(403).json({ ok: false, message: "Access denied" });
  }

  const { user_id, date_from, date_to, limit = 50 } = req.query;

  let query = knexDB("attendance_records")
    .join("users", "attendance_records.user_id", "users.user_id")
    .leftJoin("designations", "users.desg_id", "designations.desg_id")
    .select(
      "attendance_records.*",
      knexDB.raw("DATE_FORMAT(attendance_records.time_in, '%Y-%m-%d %H:%i:%s') as time_in"),
      knexDB.raw("DATE_FORMAT(attendance_records.time_out, '%Y-%m-%d %H:%i:%s') as time_out"),
      knexDB.raw("DATE_FORMAT(attendance_records.created_at, '%Y-%m-%d %H:%i:%s') as created_at"),
      knexDB.raw("DATE_FORMAT(attendance_records.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at"),
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

      const time_in = row.time_in == null ? null : String(row.time_in);
      const time_out = row.time_out == null ? null : String(row.time_out);
      const created_at = row.created_at == null ? null : String(row.created_at);
      const updated_at = row.updated_at == null ? null : String(row.updated_at);

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
    .orderBy("time_in", "desc")
    .limit(Math.min(parseInt(limit), 100)); // max limit 100

  if (date_from) {
    query = query.whereRaw("DATE(time_in) >= DATE(?)", [date_from]);
  }
  if (date_to) {
    query = query.whereRaw("DATE(time_in) <= DATE(?)", [date_to]);
  }

  const records = await query;
  // console.log(records);

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

      const time_in = row.time_in == null ? null : String(row.time_in);
      const time_out = row.time_out == null ? null : String(row.time_out);
      const created_at = row.created_at == null ? null : String(row.created_at);
      const updated_at = row.updated_at == null ? null : String(row.updated_at);

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

router.post("/correction-request", authenticateJWT, async (req, res) => {
  try {
    const {
      attendance_id,
      correction_type,
      request_date,
      requested_time_in,
      requested_time_out,
      location_id,
      reason
    } = req.body;

    const user_id = req.user.user_id;
    const org_id = req.user.org_id;

    if (!correction_type || !request_date || !reason) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!attendance_id && !location_id) {
      return res.status(400).json({ error: "Location is required for missed punch requests" });
    }

    const [id] = await knexDB("attendance_correction_requests").insert({
      org_id,
      user_id,
      attendance_id,
      correction_type,
      request_date,
      requested_time_in,
      requested_time_out,
      location_id: location_id || null,
      reason,
      status: "pending",
      audit_trail: JSON.stringify([
        { action: "submitted", by: user_id, at: new Date() }
      ])
    });

    res.status(201).json({
      message: "Correction request submitted",
      acr_id: id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit correction" });
  }
});

router.get("/correction-requests", authenticateJWT, async (req, res) => {
  try {
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
        "acr.attendance_id",
        "acr.correction_type",
        "acr.request_date",
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

  } catch (err) {
    console.error("ATTENDANCE CORRECTIONS ERROR →", err);
    res.status(500).json({
      error: "Failed to fetch corrections",
      message: err.message
    });
  }
});

router.get(
  "/correction-request/:acr_id",
  authenticateJWT,
  async (req, res) => {
    try {
      const { acr_id } = req.params;
      const org_id = req.user.org_id;
      const user_id = req.user.user_id;
      const role = req.user.user_type;

      let query = knexDB("attendance_correction_requests as acr")
        .join("users as u", "u.user_id", "acr.user_id")
        .leftJoin("designations as d", "d.desg_id", "u.desg_id")
        .leftJoin("work_locations as wl", "wl.location_id", "acr.location_id")
        .select(
          "acr.acr_id",
          "acr.attendance_id",
          "acr.correction_type",
          "acr.request_date",
          "acr.requested_time_in",
          "acr.requested_time_out",
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
          "wl.location_name"
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

    } catch (err) {
      console.error("FETCH CORRECTION ERROR →", err);
      res.status(500).json({
        error: "Failed to fetch correction",
        message: err.message
      });
    }
  }
);

router.patch(
  "/correct-request/:acr_id",
  authenticateJWT,
  async (req, res) => {
    try {
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
        // Format date for DB
        const dateStr = new Date(correction.request_date).toISOString().split('T')[0];

        const updateData = {
          status: 'PRESENT', // default to present if approved
          is_manual_adjustment: true,
          adjusted_by: reviewer_id,
          adjustment_reason: `Correction Request #${acr_id} Approved`,
          updated_at: knexDB.fn.now()
        };

        // If times provided, apply them
        if (correction.requested_time_in) {
          updateData.first_in = correction.requested_time_in;
        }
        if (correction.requested_time_out) {
          updateData.last_out = correction.requested_time_out;
        }

        // Calculate hours if both exist (Simple diff)
        if (correction.requested_time_in && correction.requested_time_out) {
          const start = new Date(`1970-01-01T${correction.requested_time_in}`);
          const end = new Date(`1970-01-01T${correction.requested_time_out}`);
          const diff = (end - start) / (1000 * 60 * 60);
          if (diff > 0) updateData.total_hours = diff.toFixed(2);
        }

        // Upsert into daily_attendance
        const existing = await knexDB("daily_attendance")
          .where({ user_id: correction.user_id, date: dateStr })
          .first();

        if (existing) {
          await knexDB("daily_attendance")
            .where({ daily_id: existing.daily_id })
            .update(updateData);
        } else {
          await knexDB("daily_attendance").insert({
            user_id: correction.user_id,
            org_id: org_id,
            date: dateStr,
            // defaulting shift? we might skip shift_id or query it
            ...updateData,
            created_at: knexDB.fn.now()
          });
        }
      }
      // ------------------------------------ --

      res.json({
        message: `Request ${status} successfully`
      });

    } catch (err) {
      console.error("UPDATE CORRECTION STATUS ERROR →", err);
      res.status(500).json({
        error: "Failed to update status",
        message: err.message
      });
    }
  }
);

export default router;