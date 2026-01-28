import express from "express";
import { knexDB } from "../database.js";
import { authenticateJWT } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import EventBus from "../utils/EventBus.js";
import { getEventSource } from "../utils/clientInfo.js";
import multer from "multer";
import ExcelJS from "exceljs";
import { PassThrough } from "stream";

const router = express.Router();
const upload = multer(); // memory storage

const ALLOWED_UPDATE_FIELDS = new Set([
  "user_name",
  "user_password",
  "email",
  "phone_no",
  "desg_id",
  "dept_id",
  "shift_id",
  "user_type"
]);

// GET all users
router.get("/users", authenticateJWT, catchAsync(async (req, res, next) => {
  if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
    throw new AppError("Only admin and HR can access user Data", 403);
  }

  const includeWorkLocation = req.query.workLocation === 'true';

  let usersQuery = knexDB('users as u')
    .leftJoin('designations as d', 'u.desg_id', 'd.desg_id')
    .leftJoin('departments as dep', 'u.dept_id', 'dep.dept_id')
    .leftJoin('shifts as s', 'u.shift_id', 's.shift_id')
    .select(
      'u.user_id',
      'u.user_name',
      'u.email',
      'u.phone_no',
      'u.user_type',
      'd.desg_name',
      'd.desg_id',
      'dep.dept_name',
      'dep.dept_id',
      's.shift_name',
      's.shift_id',
      'u.profile_image_url'
    )
    .where('u.org_id', req.user.org_id);

  const users = await usersQuery;

  let workLocationMap = {};
  if (includeWorkLocation) {
    const workLocationsData = await knexDB('user_work_locations as uwl')
      .join('work_locations as wl', 'uwl.location_id', 'wl.location_id')
      .select(
        'uwl.user_id',
        'wl.location_id as loc_id',
        'wl.location_name as loc_name',
        'wl.latitude',
        'wl.longitude',
        'wl.radius',
        'wl.is_active'
      );

    for (const row of workLocationsData) {
      if (!workLocationMap[row.user_id]) workLocationMap[row.user_id] = [];
      workLocationMap[row.user_id].push({
        loc_id: row.loc_id,
        loc_name: row.loc_name,
        latitude: row.latitude,
        longitude: row.longitude,
        radius: row.radius,
        is_active: row.is_active
      });
    }
  }

  const usersWithLocations = users.map(u => {
    const userObj = { ...u };

    if (includeWorkLocation) {
      userObj.work_locations = workLocationMap[u.user_id] || [];
    }

    return userObj;
  });

  res.json({
    success: true,
    users: usersWithLocations,
  });
}));

// GET single user by ID
router.get("/user/:user_id", authenticateJWT, catchAsync(async (req, res, next) => {
  if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
    throw new AppError("Only admin and HR can access user Data", 403);
  }

  const { user_id } = req.params;

  const user = await knexDB('users as u')
    .leftJoin('designations as d', 'u.desg_id', 'd.desg_id')
    .leftJoin('departments as dep', 'u.dept_id', 'dep.dept_id')
    .leftJoin('shifts as s', 'u.shift_id', 's.shift_id')
    .select(
      'u.user_id',
      'u.user_name',
      'u.email',
      'u.phone_no',
      'u.user_type',
      'u.desg_id',
      'u.dept_id',
      'u.shift_id',
      'u.org_id',
      'u.profile_image_url',
      'd.desg_name',
      'dep.dept_name',
      's.shift_name'
    )
    .where('u.user_id', user_id)
    .andWhere('u.org_id', req.user.org_id)
    .first();

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Get work locations for this user
  const workLocations = await knexDB('user_work_locations as uwl')
    .join('work_locations as wl', 'uwl.location_id', 'wl.location_id')
    .select(
      'wl.location_id',
      'wl.location_name',
      'wl.latitude',
      'wl.longitude',
      'wl.radius'
    )
    .where('uwl.user_id', user_id);

  user.work_locations = workLocations;

  res.json({
    success: true,
    user: user,
  });
}));

// GET all departments
router.get("/departments", authenticateJWT, catchAsync(async (req, res) => {
  const data = await knexDB("departments").where('org_id', req.user.org_id).select("*");
  res.json({ success: true, departments: data });
}));

// GET all designations
router.get("/designations", authenticateJWT, catchAsync(async (req, res) => {
  const data = await knexDB("designations").where('org_id', req.user.org_id).select("*");
  res.json({ success: true, designations: data });
}));

// GET all shifts
router.get("/shifts", authenticateJWT, catchAsync(async (req, res) => {
  const data = await knexDB("shifts").where('org_id', req.user.org_id).select("*");
  res.json({ success: true, shifts: data });
}));


// CREATE new department
router.post("/departments", authenticateJWT, catchAsync(async (req, res) => {
  if (req.user.user_type !== "admin") {
    throw new AppError("Only admin can create departments", 403);
  }
  const { dept_name } = req.body;
  if (!dept_name) throw new AppError("Department name is required", 400);

  // Check duplicate
  const existing = await knexDB("departments")
    .where({ dept_name, org_id: req.user.org_id })
    .first();

  if (existing) throw new AppError("Department already exists", 400);

  const [newId] = await knexDB("departments").insert({
    dept_name,
    org_id: req.user.org_id
  });

  res.status(201).json({ success: true, message: "Department created", dept_id: newId });
}));

// CREATE new designation
router.post("/designations", authenticateJWT, catchAsync(async (req, res) => {
  if (req.user.user_type !== "admin") {
    throw new AppError("Only admin can create designations", 403);
  }
  const { desg_name } = req.body;
  if (!desg_name) throw new AppError("Designation name is required", 400);

  const existing = await knexDB("designations")
    .where({ desg_name, org_id: req.user.org_id })
    .first();

  if (existing) throw new AppError("Designation already exists", 400);

  const [newId] = await knexDB("designations").insert({
    desg_name,
    org_id: req.user.org_id
  });

  res.status(201).json({ success: true, message: "Designation created", desg_id: newId });
}));


// CREATE new user
router.post("/user", authenticateJWT, catchAsync(async (req, res, next) => {
  if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
    throw new AppError("Only admin and HR can create users", 403);
  }

  const {
    user_name, user_password, email, phone_no,
    desg_id, dept_id, shift_id, user_type
  } = req.body;

  if (!user_name || !user_password || !email) {
    throw new AppError("Missing required fields (Name, Password, Email)", 400);
  }

  // 0. Check Duplicates (Email is mandatory, Phone is optional but unique if provided)
  const existingEmail = await knexDB("users").where({ email }).first();
  if (existingEmail) {
    throw new AppError("Email is already taken", 400);
  }

  const phoneToSave = phone_no && phone_no.trim() !== "" ? phone_no.trim() : null;

  if (phoneToSave) {
    const existingPhone = await knexDB("users").where({ phone_no: phoneToSave }).first();
    if (existingPhone) {
      throw new AppError("Mobile number is already taken", 400);
    }
  }

  // 1. Hash Password
  const hashedPassword = await bcrypt.hash(user_password, 12);
  let newUserId;

  await knexDB.transaction(async (trx) => {
    // 2. Lock Organization Row
    const org = await trx("organizations")
      .where({ org_id: req.user.org_id })
      .forUpdate()
      .first();

    if (!org) {
      throw new AppError("Organization not found", 404);
    }

    // 3. Increment counter
    const nextNumber = org.last_user_number + 1;

    // 4. Generate user_code (space preserved)
    const userCode = `${org.org_code}-${String(nextNumber).padStart(3, "0")}`;

    // 5. Update org counter
    await trx("organizations")
      .where({ org_id: req.user.org_id })
      .update({ last_user_number: nextNumber });

    // 6. Insert user WITH user_code
    const [insertedId] = await trx("users").insert({
      org_id: req.user.org_id,
      user_name,
      user_code: userCode,
      user_password: hashedPassword,
      email,
      phone_no: phoneToSave,
      desg_id: desg_id || null,
      dept_id: dept_id || null,
      shift_id: shift_id || null,
      user_type: user_type || "employee"
    });

    if (!insertedId) {
      throw new AppError("Failed to create user", 500);
    }

    newUserId = insertedId;

    // 7. Activity log (non-blocking)
    try {
      EventBus.emitActivityLog({
        user_id: req.user.user_id,
        org_id: req.user.org_id,
        event_type: "CREATE",
        event_source: getEventSource(req),
        object_type: "USER",
        object_id: newUserId,
        description: `Created user ${user_name} (${user_type || "employee"})`,
        request_ip: req.ip,
        user_agent: req.get("User-Agent")
      });
    } catch (logErr) {
      console.error("Failed to log activity:", logErr);
    }
  });

  res.status(201).json({
    success: true,
    message: "User created successfully",
    inserted_id: newUserId
  });
})
);


// BULK CREATE users from CSV/Excel
router.post("/users/bulk", authenticateJWT, upload.single("file"), catchAsync(async (req, res, next) => {
  if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
    throw new AppError("Only admin and HR can perform bulk operations", 403);
  }
  if (!req.file) {
    throw new AppError("Please upload a CSV or Excel file", 400);
  }

  const workbook = new ExcelJS.Workbook();
  const buffer = req.file.buffer;
  const mimeType = req.file.mimetype;
  const originalName = req.file.originalname.toLowerCase();

  if (mimeType.includes("csv") || originalName.endsWith(".csv")) {
    const bufferStream = new PassThrough();
    bufferStream.end(buffer);
    await workbook.csv.read(bufferStream);
  } else {
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.getWorksheet(1); // First sheet
  if (!worksheet) {
    throw new AppError("Invalid or empty file", 400);
  }
  const results = {
    total_processed: 0,
    success_count: 0,
    failure_count: 0,
    errors: []
  };


  // Clean headers map
  const headerMap = {};
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const val = cell.value ? cell.value.toString().toLowerCase().trim() : "";
    headerMap[val] = colNumber;
  });

  // Helper to get val
  const getVal = (row, key) => {
    const col = headerMap[key];
    if (!col) return null;
    const cell = row.getCell(col);
    return cell.value ? cell.value.toString().trim() : null;
  };

  const rowsData = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rowsData.push({ row, rowNumber });
  });

  // Collect unique values
  const uniqueDepts = new Set();
  const uniqueDesgs = new Set();
  const uniqueShifts = new Set();

  for (const { row } of rowsData) {
    const dept = getVal(row, "department") || getVal(row, "dept");
    const desg = getVal(row, "designation") || getVal(row, "role");
    const shift = getVal(row, "shift");

    if (dept) uniqueDepts.add(dept);
    if (desg) uniqueDesgs.add(desg);
    if (shift) uniqueShifts.add(shift);
  }

  const deptMap = {}; // Name -> ID
  const desgMap = {}; // Name -> ID
  const shiftMap = {}; // Name -> ID

  await knexDB.transaction(async (trx) => {

    // ================= OUR PART (START) =================

    // 🔐 Lock organization row ONCE
    const org = await trx("organizations")
      .where({ org_id: req.user.org_id })
      .forUpdate()
      .first();

    if (!org) {
      throw new AppError("Organization not found", 404);
    }

    // Local counter for bulk users
    let nextUserNumber = org.last_user_number;

    // ================= OUR PART (END) =================


    // Resolve Departments
    for (const deptName of uniqueDepts) {
      let dept = await trx("departments")
        .where({ dept_name: deptName, org_id: req.user.org_id })
        .first();

      if (!dept) {
        const [newId] = await trx("departments").insert({
          dept_name: deptName,
          org_id: req.user.org_id
        });
        deptMap[deptName.toLowerCase()] = newId;
      } else {
        deptMap[deptName.toLowerCase()] = dept.dept_id;
      }
    }

    // Resolve Designations
    for (const desgName of uniqueDesgs) {
      let desg = await trx("designations")
        .where({ desg_name: desgName, org_id: req.user.org_id })
        .first();

      if (!desg) {
        const [newId] = await trx("designations").insert({
          desg_name: desgName,
          org_id: req.user.org_id
        });
        desgMap[desgName.toLowerCase()] = newId;
      } else {
        desgMap[desgName.toLowerCase()] = desg.desg_id;
      }
    }

    // Resolve Shifts
    const allShifts = await trx("shifts")
      .where({ org_id: req.user.org_id })
      .select("shift_id", "shift_name");

    for (const sh of allShifts) {
      shiftMap[sh.shift_name.toLowerCase()] = sh.shift_id;
    }

    // 2. Process Users
    for (const { row, rowNumber } of rowsData) {
      results.total_processed++;

      const name = getVal(row, "name") || getVal(row, "user_name");
      const email = getVal(row, "email");
      const phone = getVal(row, "phone") || getVal(row, "phone_no");

      const deptName = getVal(row, "department") || getVal(row, "dept");
      const desgName = getVal(row, "designation") || getVal(row, "role");
      const shiftName = getVal(row, "shift");

      const password = getVal(row, "password") || `${name}-${req.user.org_id}`;
      const type = getVal(row, "type") || "employee";

      if (!name || !email) {
        results.failure_count++;
        results.errors.push(`Row ${rowNumber}: Missing Name or Email`);
        continue;
      }

      const existing = await trx("users")
        .where({ email })
        .orWhere({ phone_no: phone })
        .first();

      if (existing) {
        results.failure_count++;
        results.errors.push(`Row ${rowNumber}: Duplicate Email/Phone`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const deptId = deptName ? deptMap[deptName.toLowerCase()] : null;
      const desgId = desgName ? desgMap[desgName.toLowerCase()] : null;
      const shiftId = shiftName ? shiftMap[shiftName.toLowerCase()] : null;

      // ================= OUR PART (START) =================

      nextUserNumber++;

      const userCode = `${org.org_code || org.org_name}-${String(nextUserNumber).padStart(3, "0")}`;

      // ================= OUR PART (END) =================

      await trx("users").insert({
        org_id: req.user.org_id,
        user_name: name,
        user_code: userCode,
        email: email,
        phone_no: phone || "",
        user_password: hashedPassword,
        user_type: type,
        dept_id: deptId,
        desg_id: desgId,
        shift_id: shiftId
      });

      results.success_count++;
    }
    // Update org counter ONCE
    await trx("organizations")
      .where({ org_id: req.user.org_id })
      .update({ last_user_number: nextUserNumber });
  });

  res.json({ ok: true, report: results });
}));

// GET dashboard stats
router.get("/dashboard-stats", authenticateJWT, catchAsync(async (req, res) => {
  const org_id = req.user.org_id;
  const range = req.query.range || 'weekly'; // daily, weekly, monthly, custom
  const year = req.query.year;
  const month = req.query.month; // 1-12
  const today = new Date().toISOString().split('T')[0];

  let currentStartStr, currentEndStr, prevStartStr, prevEndStr, daysInPeriod;

  if (year && month) {
    // Custom Month Selection
    const selectedMonth = parseInt(month);
    const selectedYear = parseInt(year);

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0); // Last day of month

    currentStartStr = startDate.toISOString().split('T')[0];
    currentEndStr = endDate.toISOString().split('T')[0];
    daysInPeriod = endDate.getDate();

    // Previous Month for Trend
    const prevMonthDate = new Date(selectedYear, selectedMonth - 2, 1);
    const prevMonthEndDate = new Date(selectedYear, selectedMonth - 1, 0);
    prevStartStr = prevMonthDate.toISOString().split('T')[0];
    prevEndStr = prevMonthEndDate.toISOString().split('T')[0];
  } else if (range === 'daily') {
    currentStartStr = today;
    currentEndStr = today;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    prevStartStr = yesterday.toISOString().split('T')[0];
    prevEndStr = today;
    daysInPeriod = 1;
  } else if (range === 'monthly') {
    const currentStart = new Date();
    currentStart.setDate(currentStart.getDate() - 29);
    currentStartStr = currentStart.toISOString().split('T')[0];
    currentEndStr = today;

    const prevStart = new Date();
    prevStart.setDate(prevStart.getDate() - 59);
    prevStartStr = prevStart.toISOString().split('T')[0];
    prevEndStr = currentStartStr;
    daysInPeriod = 30;
  } else {
    // default: weekly
    const currentStart = new Date();
    currentStart.setDate(currentStart.getDate() - 6);
    currentStartStr = currentStart.toISOString().split('T')[0];
    currentEndStr = today;

    const prevStart = new Date();
    prevStart.setDate(prevStart.getDate() - 13);
    prevStartStr = prevStart.toISOString().split('T')[0];
    prevEndStr = currentStartStr;
    daysInPeriod = 7;
  }

  // Execute all queries in parallel
  const [
    totalEmployeesRes,
    presentTodayRes,
    lateCheckinsRes,
    periodPresentRes,
    prevPeriodPresentRes,
    periodLateRes,
    prevPeriodLateRes,
    activities
  ] = await Promise.all([
    // 1. Total Employees
    knexDB("users").where("org_id", org_id).where("user_type", "employee").count("user_id as count").first(),

    // 2. Present Today
    knexDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) = ?", [today]).countDistinct("user_id as count").first(),

    // 3. Late Check-ins Today
    knexDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) = ?", [today]).where("late_minutes", ">", 0).countDistinct("user_id as count").first(),

    // Period Stats
    knexDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) >= ? AND DATE(time_in) <= ?", [currentStartStr, currentEndStr]).countDistinct("user_id as count").first(),
    knexDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) >= ? AND DATE(time_in) <= ?", [prevStartStr, prevEndStr]).countDistinct("user_id as count").first(),
    knexDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) >= ? AND DATE(time_in) <= ? AND late_minutes > 0", [currentStartStr, currentEndStr]).countDistinct("user_id as count").first(),
    knexDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) >= ? AND DATE(time_in) <= ? AND late_minutes > 0", [prevStartStr, prevEndStr]).countDistinct("user_id as count").first(),

    // 5. Activity Log
    knexDB("user_activity_logs as al")
      .leftJoin("users as u", "al.user_id", "u.user_id")
      .leftJoin("designations as d", "u.desg_id", "d.desg_id")
      .select("al.activity_id as id", "u.user_name as user", "d.desg_name as role", "al.description as action", "al.occurred_at as time", "u.profile_image_url")
      .where("al.org_id", org_id)
      .whereRaw("DATE(al.occurred_at) = ?", [today])
      .orderBy("al.occurred_at", "desc")
      .limit(20)
  ]);

  const totalEmployees = totalEmployeesRes.count || 0;
  const presentToday = presentTodayRes.count || 0;
  const lateCheckins = lateCheckinsRes.count || 0;
  const absentToday = Math.max(0, totalEmployees - presentToday);

  const periodPresentAvg = (periodPresentRes.count || 0) / daysInPeriod;
  const prevPeriodPresentAvg = (prevPeriodPresentRes.count || 0) / daysInPeriod;
  const periodLateAvg = (periodLateRes.count || 0) / daysInPeriod;
  const prevPeriodLateAvg = (prevPeriodLateRes.count || 0) / daysInPeriod;

  const periodAbsentAvg = Math.max(0, totalEmployees - periodPresentAvg);
  const prevPeriodAbsentAvg = Math.max(0, totalEmployees - prevPeriodPresentAvg);

  // Helper for trend calculation
  const calculateTrend = (current, previous) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const trends = {
    present: calculateTrend(periodPresentAvg, prevPeriodPresentAvg),
    absent: calculateTrend(periodAbsentAvg, prevPeriodAbsentAvg),
    late: calculateTrend(periodLateAvg, prevPeriodLateAvg)
  };

  // 4.2 Chart Data
  const chartDaysCount = range === 'monthly' ? 30 : 7;
  const chartDays = [];
  if (year && month) {
    for (let d = 1; d <= daysInPeriod; d++) {
      const date = new Date(year, month - 1, d);
      chartDays.push(date.toISOString().split('T')[0]);
    }
  } else {
    for (let i = chartDaysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      chartDays.push(d.toISOString().split('T')[0]);
    }
  }

  const chartDataPromises = chartDays.map(async (dayStr) => {
    const dayName = new Date(dayStr).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    const [pRes, lRes] = await Promise.all([
      knexDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) = ?", [dayStr]).countDistinct("user_id as count").first(),
      knexDB("attendance_records").where("org_id", org_id).whereRaw("DATE(time_in) = ?", [dayStr]).where("late_minutes", ">", 0).countDistinct("user_id as count").first()
    ]);
    const present = Number(pRes.count || 0);
    const late = Number(lRes.count || 0);
    const total = Number(totalEmployees || 0);
    const absent = Math.max(0, total - present);
    return { name: dayName, present, late, absent };
  });

  const chartData = await Promise.all(chartDataPromises);

  res.json({
    success: true,
    stats: { presentToday, totalEmployees, absentToday, lateCheckins },
    trends,
    chartData,
    activities: activities.map(a => ({
      ...a,
      time: new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: a.action.toLowerCase().includes('clocked in') ? 'present' :
        a.action.toLowerCase().includes('late') ? 'late' : 'absent'
    }))
  });
}));


// UPDATE user by user_id
router.put("/user/:user_id", authenticateJWT, catchAsync(async (req, res, next) => {
  if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
    throw new AppError("Only admin and HR can update user data", 403);
  }

  const { user_id } = req.params;

  if (!user_id || isNaN(parseInt(user_id))) {
    throw new AppError("Invalid User ID", 400);
  }

  const updates = {};

  // Check forDuplicates if email or phone is being updated
  if (req.body.email) {
    const existing = await knexDB("users")
      .where({ email: req.body.email })
      .andWhereNot({ user_id })
      .first();
    if (existing) throw new AppError("Email is already taken", 400);
  }

  if (req.body.phone_no && req.body.phone_no.trim() !== "") {
    const existing = await knexDB("users")
      .where({ phone_no: req.body.phone_no.trim() })
      .andWhereNot({ user_id })
      .first();
    if (existing) throw new AppError("Mobile number is already taken", 400);
  }

  // Filter and prepare updates
  for (const key of Object.keys(req.body)) {
    if (ALLOWED_UPDATE_FIELDS.has(key)) {
      if (key === "user_password") {
        if (req.body.user_password && req.body.user_password.trim() !== "") {
          updates.user_password = await bcrypt.hash(req.body.user_password, 12);
        }
      } else if (key === "phone_no") {
        // Handle phone specifically to allow nulling it out or updating
        if (req.body.phone_no && req.body.phone_no.trim() !== "") {
          updates.phone_no = req.body.phone_no.trim();
        } else {
          updates.phone_no = null; // Set to null if empty string provided
        }
      } else {
        // Handle optional foreign keys: convert empty string to null to avoid FK constraint violation
        if (["desg_id", "dept_id", "shift_id"].includes(key) && req.body[key] === "") {
          updates[key] = null;
        } else {
          updates[key] = req.body[key];
        }
      }
    }
  }

  // Transaction for atomic updates (User data + Task Controls)
  await knexDB.transaction(async (trx) => {
    // 1. Update User Table
    if (Object.keys(updates).length > 0) {
      const affected = await trx('users')
        .where('user_id', user_id)
        .andWhere('org_id', req.user.org_id)
        .update(updates);

      if (affected === 0) {
        throw new AppError("User not found or unauthorized", 404);
      }
    }

    // 2. Update Task Controls (REMOVED)
  });

  res.json({ success: true, message: "User updated successfully" });
}));


// DELETE user by user_id
router.delete("/user/:user_id", authenticateJWT, catchAsync(async (req, res, next) => {
  if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
    throw new AppError("Only admin and HR can delete users", 403);
  }

  const { user_id } = req.params;

  if (!user_id || isNaN(parseInt(user_id))) {
    throw new AppError("Invalid User ID", 400);
  }

  if (parseInt(user_id) === req.user.user_id) {
    throw new AppError("You cannot delete your own account", 400);
  }

  const affected = await knexDB('users')
    .where('user_id', user_id)
    .andWhere('org_id', req.user.org_id)
    .del();

  if (affected === 0) {
    throw new AppError("User not found", 404);
  }

  res.json({ message: "User deleted successfully" });
}));


// BULK VALIDATE (Pre-check)
router.post("/users/bulk-validate", authenticateJWT, catchAsync(async (req, res, next) => {
  if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
    throw new AppError("Only admin and HR can perform bulk operations", 403);
  }

  const { users } = req.body;
  if (!users || !Array.isArray(users)) {
    throw new AppError("Invalid users list", 400);
  }

  const response = {
    duplicates: [], // { row: 1, email: '...', reason: '...' }
    new_departments: [], // ['AI', 'Labs']
    new_designations: [], // ['Chief']
    valid_count: 0
  };

  // 1. Collect unique values from input
  const inputEmails = new Set();
  const inputPhones = new Set();
  const inputDepts = new Set();
  const inputDesgs = new Set();

  users.forEach((u, index) => {
    const rowNum = index + 1;
    const email = u['Email'] || u['email'];
    const phone = u['Phone'] || u['phone'] || u['phone_no'];
    const dept = u['Department'] || u['department'] || u['dept'];
    const desg = u['Designation'] || u['designation'] || u['role'] || u['Role'];

    if (email) inputEmails.add(email);
    if (phone) inputPhones.add(phone.toString().trim());
    if (dept) inputDepts.add(dept.toLowerCase());
    if (desg) inputDesgs.add(desg.toLowerCase());
  });

  // 2. Database Checks

  // Check Existing Emails
  if (inputEmails.size > 0) {
    const existingUsers = await knexDB("users")
      .whereIn('email', Array.from(inputEmails))
      .select('email', 'user_id');

    const existingEmailSet = new Set(existingUsers.map(u => u.email));

    // Check Existing Phones
    let existingPhoneSet = new Set();
    if (inputPhones.size > 0) {
      const existingPhones = await knexDB("users")
        .whereIn('phone_no', Array.from(inputPhones))
        .select('phone_no');
      existingPhoneSet = new Set(existingPhones.map(u => u.phone_no));
    }

    // Map back to rows to find which ones are duplicates
    users.forEach((u, index) => {
      const rowNum = index + 1;
      const email = u['Email'] || u['email'];
      const phone = u['Phone'] || u['phone'] || u['phone_no'];

      let isDuplicate = false;
      if (email && existingEmailSet.has(email)) {
        response.duplicates.push({ row: rowNum, email, reason: "Email already exists" });
        isDuplicate = true;
      }
      if (phone && existingPhoneSet.has(phone.toString().trim())) {
        response.duplicates.push({ row: rowNum, phone, reason: "Phone number already exists" });
        isDuplicate = true;
      }

      if (!isDuplicate) response.valid_count++;
    });
  } else {
    response.valid_count = users.length;
  }

  // Check Departments (Find which ones are NEW)
  if (inputDepts.size > 0) {
    const existingDepts = await knexDB("departments")
      .where('org_id', req.user.org_id)
      .whereIn(knexDB.raw('LOWER(dept_name)'), Array.from(inputDepts))
      .select('dept_name');

    const existingDeptSet = new Set(existingDepts.map(d => d.dept_name.toLowerCase()));

    // Any input dept NOT in existingDeptSet is NEW
    inputDepts.forEach(d => {
      if (!existingDeptSet.has(d)) {
        // Find original casing from input (first match)
        const original = users.find(u => (u['Department'] || u['department'] || u['dept'])?.toLowerCase() === d);
        const name = original ? (original['Department'] || original['department'] || original['dept']) : d;
        response.new_departments.push(name);
      }
    });
  }

  // Check Designations (Find which ones are NEW)
  if (inputDesgs.size > 0) {
    const existingDesgs = await knexDB("designations")
      .where('org_id', req.user.org_id)
      .whereIn(knexDB.raw('LOWER(desg_name)'), Array.from(inputDesgs))
      .select('desg_name');

    const existingDesgSet = new Set(existingDesgs.map(d => d.desg_name.toLowerCase()));

    inputDesgs.forEach(d => {
      if (!existingDesgSet.has(d)) {
        const original = users.find(u => (u['Designation'] || u['designation'] || u['role'] || u['Role'])?.toLowerCase() === d);
        const name = original ? (original['Designation'] || original['designation'] || original['role'] || original['Role']) : d;
        response.new_designations.push(name);
      }
    });
  }

  res.json({ success: true, validation: response });
}));


// BULK CREATE users from JSON (Frontend Parsed)
router.post("/users/bulk-json", authenticateJWT, catchAsync(async (req, res, next) => {
  if (req.user.user_type !== "admin") {
    throw new AppError("Only admin can perform bulk operations", 403);
  }

  const { users } = req.body;
  if (!users || !Array.isArray(users) || users.length === 0) {
    throw new AppError("Invalid data provided", 400);
  }

  const results = {
    total_processed: 0,
    success_count: 0,
    failure_count: 0,
    errors: []
  };

  // 1. Scan and resolve Departments, Designations, and Shifts
  const uniqueDepts = new Set();
  const uniqueDesgs = new Set();
  const uniqueShifts = new Set();

  for (const row of users) {
    const dept = row["Department"] || row["department"] || row["dept"];
    const desg = row["Designation"] || row["designation"] || row["role"] || row["Role"];
    const shift = row["Shift"] || row["shift"];

    if (dept) uniqueDepts.add(dept);
    if (desg) uniqueDesgs.add(desg);
    if (shift) uniqueShifts.add(shift);
  }

  const deptMap = {}; // Name -> ID
  const desgMap = {}; // Name -> ID
  const shiftMap = {}; // Name -> ID

  await knexDB.transaction(async (trx) => {
    // A. Resolve Departments
    for (const deptName of uniqueDepts) {
      if (!deptName) continue;
      let dept = await trx("departments").where({ dept_name: deptName, org_id: req.user.org_id }).first();
      if (!dept) {
        const [newId] = await trx("departments").insert({
          dept_name: deptName,
          org_id: req.user.org_id
        });
        deptMap[deptName.toLowerCase()] = newId;
      } else {
        deptMap[deptName.toLowerCase()] = dept.dept_id;
      }
    }

    // B. Resolve Designations
    for (const desgName of uniqueDesgs) {
      if (!desgName) continue;
      let desg = await trx("designations").where({ desg_name: desgName, org_id: req.user.org_id }).first();
      if (!desg) {
        const [newId] = await trx("designations").insert({
          desg_name: desgName,
          org_id: req.user.org_id
        });
        desgMap[desgName.toLowerCase()] = newId;
      } else {
        desgMap[desgName.toLowerCase()] = desg.desg_id;
      }
    }

    // C. Resolve Shifts (Read-only)
    const allShifts = await trx("shifts").where({ org_id: req.user.org_id }).select('shift_id', 'shift_name');
    for (const sh of allShifts) {
      shiftMap[sh.shift_name.toLowerCase()] = sh.shift_id;
    }

    // D. Lock organization row for counter
    const org = await trx("organizations")
      .where({ org_id: req.user.org_id })
      .forUpdate()
      .first();

    if (!org) {
      throw new AppError("Organization not found", 404);
    }

    let nextUserNumber = org.last_user_number;

    // 2. Process Users
    let rowNumber = 0;
    for (const row of users) {
      rowNumber++;
      results.total_processed++;

      // Map fields from JSON (Frontend keys might vary slightly, ensure consistency)
      const name = row['Name'] || row['name'] || row['user_name'];
      const email = row['Email'] || row['email'];
      const phoneRaw = row['Phone'] || row['phone'] || row['phone_no'];
      const phone = phoneRaw ? phoneRaw.toString().trim() : null; // Ensure string

      const deptName = row["Department"] || row["department"] || row["dept"];
      const desgName = row["Designation"] || row["designation"] || row["role"] || row["Role"];
      const shiftName = row["Shift"] || row["shift"];

      // Password
      const password = row["Password"] || row["password"] || `${name}-${req.user.org_id}`;
      const type = "employee";

      if (!name || !email) {
        results.failure_count++;
        results.errors.push(`Row ${rowNumber}: Missing Name or Email`);
        continue;
      }

      try {
        // Check duplicates
        let duplicateQuery = trx("users").where({ email });
        if (phone) {
          duplicateQuery = duplicateQuery.orWhere({ phone_no: phone });
        }
        const existing = await duplicateQuery.first();

        if (existing) {
          results.failure_count++;
          results.errors.push(`Row ${rowNumber}: Duplicate Email/Phone (${email})`);
          continue;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Resolve IDs
        const deptId = deptName ? deptMap[deptName.toLowerCase()] : null;
        const desgId = desgName ? desgMap[desgName.toLowerCase()] : null;
        const shiftId = shiftName ? shiftMap[shiftName.toLowerCase()] : null;

        nextUserNumber++;
        const userCode = `${org.org_code}-${String(nextUserNumber).padStart(3, "0")}`;

        await trx("users").insert({
          org_id: req.user.org_id,
          user_name: name,
          user_code: userCode,
          email: email,
          phone_no: phone,
          user_password: hashedPassword,
          user_type: type,
          dept_id: deptId,
          desg_id: desgId,
          shift_id: shiftId
        });

        results.success_count++;
      } catch (err) {
        results.failure_count++;
        results.errors.push(`Row ${rowNumber}: ${err.message}`);
      }
    }

    // Update org counter
    await trx("organizations")
      .where({ org_id: req.user.org_id })
      .update({ last_user_number: nextUserNumber });
  });

  res.json({ ok: true, report: results });
}));


export default router;

