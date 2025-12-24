// src/utils/exportAttendance.js
import ExcelJS from "exceljs";
import { knexDB } from "../Database.js";

// Helper to convert column index (1-based) to Excel Letter (e.g., 1->A, 27->AA)
function getColumnLetter(colIndex) {
  let letter = '';
  while (colIndex > 0) {
    let temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = (colIndex - temp - 1) / 26;
  }
  return letter;
}

function getDatesInRange(startDate, endDate) {
  const date = new Date(startDate);
  const end = new Date(endDate);
  const dates = [];
  while (date <= end) {
    dates.push(new Date(date).toISOString().split('T')[0]);
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

export async function exportAttendanceToFile(filePath, startDate, endDate, specificUserId = null) {
  // 1. Fetch Users
  let usersQuery = knexDB("users").select("user_id", "user_name", "email", "designation").orderBy("user_name", "asc");
  if (specificUserId) {
    usersQuery = usersQuery.where("user_id", specificUserId);
  }
  const users = await usersQuery;

  // 2. Fetch Attendance Records within Date Range
  let attendanceQuery = knexDB("attendance_records")
    .whereRaw("DATE(time_in) >= ?", [startDate])
    .whereRaw("DATE(time_in) <= ?", [endDate]);

  if (specificUserId) {
    attendanceQuery = attendanceQuery.where("user_id", specificUserId);
  }

  const rawRecords = await attendanceQuery.select(
    "*",
    knexDB.raw("DATE_FORMAT(time_in, '%Y-%m-%d %H:%i:%s') as time_in_str"),
    knexDB.raw("DATE_FORMAT(time_out, '%Y-%m-%d %H:%i:%s') as time_out_str")
  ).orderBy("time_in", "asc");

  // 3. Organize Records by User -> Date
  const recordsByUserDate = {}; // { userId: { dateString: { firstIn, lastOut } } }

  rawRecords.forEach(r => {
    if (!r.time_in) return;
    const dateStr = new Date(r.time_in).toISOString().split('T')[0];

    if (!recordsByUserDate[r.user_id]) recordsByUserDate[r.user_id] = {};
    if (!recordsByUserDate[r.user_id][dateStr]) {
      recordsByUserDate[r.user_id][dateStr] = {
        firstIn: new Date(r.time_in),
        lastOut: r.time_out ? new Date(r.time_out) : null
      };
    } else {
      // Update logic: keep earliest IN, latest OUT
      const existing = recordsByUserDate[r.user_id][dateStr];
      const newIn = new Date(r.time_in);
      const newOut = r.time_out ? new Date(r.time_out) : null;

      if (newIn < existing.firstIn) existing.firstIn = newIn;
      if (newOut) {
        if (!existing.lastOut || newOut > existing.lastOut) {
          existing.lastOut = newOut;
        }
      }
    }
  });

  // 4. Create Workbook & Sheet
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Month Attendance", {
    views: [{ showGridLines: true, state: 'frozen', xSplit: 4, ySplit: 2 }]
  });

  // 5. Build Headers
  const allDates = getDatesInRange(startDate, endDate);

  // Fixed Columns: S.No, Name, Position, Present Days
  const fixedHeaders = ["S.No", "Name", "Position", "Present Days"];
  const dateHeaders = allDates.map(d => {
    const dateObj = new Date(d);
    // Format: "01-Nov"
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = dateObj.toLocaleString('default', { month: 'short' });
    return `${day}-${month}`;
  });

  // Header Row 1: Dates
  const headerRow = sheet.getRow(1);
  headerRow.values = [...fixedHeaders, ...dateHeaders];

  // Header Row 2: Days of week (Sun, Mon...)
  const dayRow = sheet.getRow(2);
  const dayValues = ["", "", "", ""]; // spacers for fixed cols
  allDates.forEach(d => {
    const dateObj = new Date(d);
    dayValues.push(dateObj.toLocaleString('default', { weekday: 'short' }));
  });
  dayRow.values = dayValues;

  // Styling Headers
  [headerRow, dayRow].forEach(row => {
    row.font = { bold: true };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 25;
  });

  // Fill Sunday Columns Yellow
  const sundayCols = [];
  allDates.forEach((d, idx) => {
    const dateObj = new Date(d);
    if (dateObj.getDay() === 0) { // 0 is Sunday
      sundayCols.push(5 + idx); // 5 because 1-based index and we skipped 4 cols (A,B,C,D) -> 1,2,3,4. So 5th is first date.
    }
  });

  // Set Column Widths
  sheet.getColumn(1).width = 6;  // S.No
  sheet.getColumn(2).width = 25; // Name
  sheet.getColumn(3).width = 15; // Position
  sheet.getColumn(4).width = 12; // Present Days

  for (let i = 0; i < allDates.length; i++) {
    sheet.getColumn(5 + i).width = 10; // Date cols
  }

  // 6. Iterate Users and Build Matrix
  let currentRowIdx = 3;

  users.forEach((user, uIdx) => {
    // User Block Indices
    const rStatus = currentRowIdx;
    const rIn = currentRowIdx + 1;
    const rOut = currentRowIdx + 2;
    const rWork = currentRowIdx + 3;

    // Row Objects
    const rowStatus = sheet.getRow(rStatus);
    const rowIn = sheet.getRow(rIn);
    const rowOut = sheet.getRow(rOut);
    const rowWork = sheet.getRow(rWork);

    // Fixed Data
    rowStatus.getCell(1).value = uIdx + 1; // S.No
    rowStatus.getCell(1).alignment = { vertical: 'top', horizontal: 'center' };
    // Merge S.No, Name, Position across 4 rows
    sheet.mergeCells(rStatus, 1, rWork, 1);

    rowStatus.getCell(2).value = user.user_name;
    rowStatus.getCell(2).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    sheet.mergeCells(rStatus, 2, rWork, 2);

    rowStatus.getCell(3).value = user.designation || "-";
    rowStatus.getCell(3).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    sheet.mergeCells(rStatus, 3, rWork, 3);

    // Formula for Present Days: Sum of Status Row for this user.
    const startColLetter = getColumnLetter(5);
    const endColLetter = getColumnLetter(5 + allDates.length - 1);

    if (allDates.length > 0) {
      rowStatus.getCell(4).value = { formula: `SUM(${startColLetter}${rStatus}:${endColLetter}${rStatus})` };
    } else {
      rowStatus.getCell(4).value = 0;
    }

    sheet.mergeCells(rStatus, 4, rWork, 4); // Merge Present Days too for clean look.
    rowStatus.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

    // Fill Data & Formulas
    const userRecords = recordsByUserDate[user.user_id] || {};

    allDates.forEach((d, dIdx) => {
      const colIdx = 5 + dIdx;
      const colLetter = getColumnLetter(colIdx);
      const cellStatus = rowStatus.getCell(colIdx);
      const cellIn = rowIn.getCell(colIdx);
      const cellOut = rowOut.getCell(colIdx);
      const cellWork = rowWork.getCell(colIdx);

      const dailyRec = userRecords[d];

      // Pre-fill Values if exist
      if (dailyRec) {
        if (dailyRec.firstIn) {
          cellIn.value = dailyRec.firstIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        if (dailyRec.lastOut) {
          cellOut.value = dailyRec.lastOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
      }

      // FORMULAS ---------------------------

      // 1. Work Hours: =IF(AND(In<>"", Out<>""), (Out-In)*24, 0)
      cellWork.value = { formula: `IF(AND(${colLetter}${rIn}<>"", ${colLetter}${rOut}<>""), (${colLetter}${rOut}-${colLetter}${rIn})*24, 0)` };
      cellWork.numFmt = '0.00';

      // 2. Status: logic
      const isSunday = sundayCols.includes(colIdx);
      let statusFormula = "";

      if (isSunday) {
        // If Sunday AND Visited -> 2. If Sunday AND Not Visited -> 1 (Weekly Off).
        statusFormula = `IF(${colLetter}${rIn}<>"", 2, 1)`;
      } else {
        // Normal Day
        // IF(In="", 0, IF(OR(In > TIME(11,0,0), IF(Out="", TRUE, Out < TIME(16,0,0))), 0.5, 1))
        statusFormula = `IF(${colLetter}${rIn}="", 0, IF(OR(${colLetter}${rIn} > TIME(11,0,0), IF(${colLetter}${rOut}="", TRUE, ${colLetter}${rOut} < TIME(16,0,0))), 0.5, 1))`;
      }

      cellStatus.value = { formula: statusFormula };

      // Styling Per Cell
      [cellStatus, cellIn, cellOut, cellWork].forEach(c => {
        c.alignment = { horizontal: 'center' };
        c.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      // Sunday Highlight
      if (isSunday) {
        [cellStatus, cellIn, cellOut, cellWork].forEach(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow
        });
      }
    });

    currentRowIdx += 4;
  });

  // Add Conditional Formatting for Status Row (0 -> Red, 0.5 -> Yellow)
  if (allDates.length > 0) {
    const startCol = getColumnLetter(5);
    const endCol = getColumnLetter(5 + allDates.length - 1);

    sheet.addConditionalFormatting({
      ref: `${startCol}3:${endCol}${currentRowIdx - 1}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['0'],
          style: { fill: { type: 'pattern', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' } } }
        },
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['0.5'],
          style: { fill: { type: 'pattern', bgColor: { argb: 'FFFFEB9C' } }, font: { color: { argb: 'FF9C6500' } } }
        }
      ]
    });
  }

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}
