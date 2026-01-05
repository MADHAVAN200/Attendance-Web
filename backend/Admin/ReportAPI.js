import express from "express";
import { knexDB } from "../database.js";
import { authenticateJWT } from "../AuthAPI/LoginAPI.js";
import catchAsync from "../utils/catchAsync.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

const router = express.Router();

// Helper: Calculate Work Hours
const calculateWorkHours = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return "0.00";
    const start = new Date(timeIn);
    const end = new Date(timeOut);
    const diffMs = end - start;
    if (diffMs < 0) return "0.00";
    return (diffMs / (1000 * 60 * 60)).toFixed(2);
};

// GET /admin/reports/preview
router.get("/preview", authenticateJWT, catchAsync(async (req, res) => {
    if (req.user.user_type !== "admin" && req.user.user_type !== "HR") {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    const { month, date, type } = req.query;
    const org_id = req.user.org_id;

    if (!type) {
        return res.status(400).json({ ok: false, message: "Report type is required" });
    }

    let startDate, endDate;
    if (type === "employee_master") {
        startDate = "2000-01-01"; // Default range for master data
        endDate = new Date().toISOString().split("T")[0];
    } else if (type === "matrix_monthly" || type === "attendance_summary" || type === "attendance_detailed" || type === "lateness_report") {
        if (!month) return res.status(400).json({ ok: false, message: "Month is required" });
        const [year, monthNum] = month.split("-");
        startDate = `${month}-01`;
        endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];
    } else if (type === "matrix_weekly") {
        if (!date) return res.status(400).json({ ok: false, message: "Date is required" });
        const start = new Date(date);
        startDate = start.toISOString().split("T")[0];
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        endDate = end.toISOString().split("T")[0];
    } else if (type === "matrix_daily") {
        if (!date) return res.status(400).json({ ok: false, message: "Date is required" });
        startDate = date;
        endDate = date;
    }

    let data = { columns: [], rows: [] };

    if (type.startsWith("matrix_")) {
        const users = await knexDB("users as u")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .select("u.user_id", "u.user_name", "d.dept_name")
            .where("u.org_id", org_id)
            .limit(20);

        const records = await knexDB("attendance_records")
            .where("org_id", org_id)
            .whereRaw("DATE(time_in) >= ?", [startDate])
            .whereRaw("DATE(time_in) <= ?", [endDate]);

        if (type === "matrix_daily") {
            data.columns = ["Name", "Dept", "Time In", "Time Out", "Work Hrs", "Status"];
            data.rows = users.map(u => {
                const rec = records.find(r => r.user_id === u.user_id);
                return [
                    u.user_name,
                    u.dept_name || "-",
                    rec?.time_in ? new Date(rec.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
                    rec?.time_out ? new Date(rec.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
                    calculateWorkHours(rec?.time_in, rec?.time_out),
                    rec?.status || "Absent"
                ];
            });
        } else {
            data.columns = ["Name", "Dept", "Present Days", "Total Hrs", "Late Count"];
            data.rows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const totalHrs = userRecs.reduce((sum, r) => sum + parseFloat(calculateWorkHours(r.time_in, r.time_out)), 0);
                const lateCount = userRecs.filter(r => r.late_minutes > 0).length;
                return [u.user_name, u.dept_name || "-", userRecs.length, totalHrs.toFixed(2), lateCount];
            });
        }
    } else if (type === "attendance_detailed") {
        const records = await knexDB("attendance_records as ar")
            .join("users as u", "ar.user_id", "u.user_id")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .select("ar.time_in", "u.user_name", "d.dept_name", "ar.time_out", "ar.status")
            .where("ar.org_id", org_id)
            .whereRaw("DATE(ar.time_in) >= ?", [startDate])
            .whereRaw("DATE(ar.time_in) <= ?", [endDate])
            .orderBy("ar.time_in", "asc")
            .limit(20);

        data.columns = ["Date", "Name", "Dept", "Time In", "Time Out", "Status"];
        data.rows = records.map(r => [
            new Date(r.time_in).toLocaleDateString(),
            r.user_name,
            r.dept_name || "-",
            r.time_in ? new Date(r.time_in).toLocaleTimeString() : "-",
            r.time_out ? new Date(r.time_out).toLocaleTimeString() : "-",
            r.status
        ]);
    } else if (type === "attendance_summary") {
        const records = await knexDB("attendance_records as ar")
            .join("users as u", "ar.user_id", "u.user_id")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .select(
                "u.user_name",
                "d.dept_name",
                knexDB.raw("COUNT(*) as total_days"),
                knexDB.raw("SUM(CASE WHEN ar.status = 'PRESENT' THEN 1 ELSE 0 END) as present_days")
            )
            .where("ar.org_id", org_id)
            .whereRaw("DATE(ar.time_in) >= ?", [startDate])
            .whereRaw("DATE(ar.time_in) <= ?", [endDate])
            .groupBy("u.user_id")
            .limit(20);

        data.columns = ["Name", "Dept", "Total Records", "Present"];
        data.rows = records.map(r => [r.user_name, r.dept_name || "-", r.total_days, r.present_days]);
    } else if (type === "lateness_report") {
        const records = await knexDB("attendance_records as ar")
            .join("users as u", "ar.user_id", "u.user_id")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .select("u.user_name", "d.dept_name", "ar.time_in", "ar.late_minutes", "ar.overtime_hours")
            .where("ar.org_id", org_id)
            .whereRaw("DATE(ar.time_in) >= ?", [startDate])
            .whereRaw("DATE(ar.time_in) <= ?", [endDate])
            .where(builder => builder.where("ar.late_minutes", ">", 0).orWhere("ar.overtime_hours", ">", 0))
            .limit(20);

        data.columns = ["Name", "Dept", "Date", "Late (Mins)", "Overtime (Mins)"];
        data.rows = records.map(r => [
            r.user_name,
            r.dept_name || "-",
            new Date(r.time_in).toLocaleDateString(),
            r.late_minutes || 0,
            r.overtime_hours || 0
        ]);
    } else if (type === "employee_master") {
        const users = await knexDB("users as u")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .leftJoin("designations as dg", "u.desg_id", "dg.desg_id")
            .select("u.user_id", "u.user_name", "u.email", "u.phone_no", "d.dept_name", "dg.desg_name", "u.user_type")
            .where("u.org_id", org_id)
            .limit(50);

        data.columns = ["ID", "Name", "Email", "Phone", "Dept", "Designation", "Role"];
        data.rows = users.map(u => [u.user_id, u.user_name, u.email, u.phone_no, u.dept_name || "-", u.desg_name || "-", u.user_type]);
    }

    res.json({ ok: true, data });
}));

// Helper: Generate PDF using PDFKit with a professional grid/table design
const generatePdf = (title, columns, rows) => {
    const doc = new PDFDocument({
        size: 'A4',
        layout: columns.length > 7 ? 'landscape' : 'portrait',
        margin: 40
    });

    const margin = 40;
    const pageWidth = doc.page.width - (margin * 2);
    const cellPadding = 5;
    const headerHeight = 25;
    const rowHeight = 20;

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(1.5);

    // Calculate column widths (simple even distribution or based on content)
    // For now, even distribution for simplicity, but we can refine
    const colWidth = pageWidth / columns.length;

    let currentY = doc.y;

    // Function to draw a horizontal line
    const drawLine = (y) => {
        doc.moveTo(margin, y)
            .lineTo(margin + pageWidth, y)
            .stroke('#cccccc');
    };

    // Function to draw vertical lines
    const drawVerticalLines = (y, height) => {
        for (let i = 0; i <= columns.length; i++) {
            doc.moveTo(margin + (i * colWidth), y)
                .lineTo(margin + (i * colWidth), y + height)
                .stroke('#cccccc');
        }
    };

    // Draw Header Background
    doc.rect(margin, currentY, pageWidth, headerHeight).fill('#f3f4f6');
    doc.fillColor('#000000'); // Reset fill color for text

    // Header Text
    doc.fontSize(10).font('Helvetica-Bold');
    columns.forEach((col, i) => {
        doc.text(col, margin + (i * colWidth) + cellPadding, currentY + (headerHeight / 4), {
            width: colWidth - (cellPadding * 2),
            align: 'left'
        });
    });

    // Draw Header Borders
    drawLine(currentY);
    drawLine(currentY + headerHeight);
    drawVerticalLines(currentY, headerHeight);

    currentY += headerHeight;

    // Data Rows
    doc.fontSize(9).font('Helvetica');
    rows.forEach((row, rowIndex) => {
        // Check for page break
        if (currentY + rowHeight > doc.page.height - margin) {
            doc.addPage();
            currentY = margin;

            // Redraw Header on new page
            doc.rect(margin, currentY, pageWidth, headerHeight).fill('#f3f4f6');
            doc.fillColor('#000000');
            doc.fontSize(10).font('Helvetica-Bold');
            columns.forEach((col, i) => {
                doc.text(col, margin + (i * colWidth) + cellPadding, currentY + (headerHeight / 4), {
                    width: colWidth - (cellPadding * 2),
                    align: 'left'
                });
            });
            drawLine(currentY);
            drawLine(currentY + headerHeight);
            drawVerticalLines(currentY, headerHeight);
            currentY += headerHeight;
            doc.fontSize(9).font('Helvetica');
        }

        row.forEach((cell, i) => {
            const cellText = cell?.toString() || "-";
            doc.text(cellText, margin + (i * colWidth) + cellPadding, currentY + (rowHeight / 4), {
                width: colWidth - (cellPadding * 2),
                align: 'left',
                lineBreak: false,
                ellipsis: true
            });
        });

        // Draw Row Border (Bottom)
        drawLine(currentY + rowHeight);
        drawVerticalLines(currentY, rowHeight);

        currentY += rowHeight;
    });

    return doc;
};

// GET /admin/reports/download OR /attendance/reports/download
router.get("/download", authenticateJWT, catchAsync(async (req, res) => {
    const { month, date, type, format = "xlsx" } = req.query;
    const org_id = req.user.org_id;
    const isUserReport = req.originalUrl.includes("/attendance/");
    const targetUserId = isUserReport ? req.user.user_id : req.query.user_id;

    if (!type) {
        return res.status(400).json({ ok: false, message: "Report Type is required" });
    }

    let startDate, endDate;
    if (type === "employee_master") {
        startDate = "2000-01-01";
        endDate = new Date().toISOString().split("T")[0];
    } else if (type === "matrix_monthly" || type === "attendance_summary" || type === "attendance_detailed" || type === "lateness_report" || isUserReport) {
        if (!month) return res.status(400).json({ ok: false, message: "Month is required" });
        const [year, monthNum] = month.split("-");
        startDate = `${month}-01`;
        endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];
    } else if (type === "matrix_weekly") {
        if (!date) return res.status(400).json({ ok: false, message: "Date is required" });
        const start = new Date(date);
        startDate = start.toISOString().split("T")[0];
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        endDate = end.toISOString().split("T")[0];
    } else if (type === "matrix_daily") {
        if (!date) return res.status(400).json({ ok: false, message: "Date is required" });
        startDate = date;
        endDate = date;
    }

    const users = await knexDB("users as u")
        .leftJoin("departments as d", "u.dept_id", "d.dept_id")
        .leftJoin("designations as dg", "u.desg_id", "dg.desg_id")
        .select("u.user_id", "u.user_name", "d.dept_name", "dg.desg_name", "u.email", "u.phone_no")
        .where("u.org_id", org_id)
        .modify(qb => { if (targetUserId) qb.where("u.user_id", targetUserId); });

    let records = [];
    if (type !== "employee_master") {
        records = await knexDB("attendance_records")
            .where("org_id", org_id)
            .whereRaw("DATE(time_in) >= ?", [startDate])
            .whereRaw("DATE(time_in) <= ?", [endDate]);
    }

    if (format === "pdf") {
        let pdfTitle = type === "employee_master" ? "Employee Master Data" : `Attendance Report - ${startDate} to ${endDate}`;
        let pdfCols, pdfRows;

        if (type === "matrix_daily" || type === "attendance_detailed") {
            pdfCols = ["Name", "Dept", "Time In", "Time Out", "Work Hrs", "Status"];
            if (type === "attendance_detailed") {
                const detailedRecords = await knexDB("attendance_records as ar")
                    .join("users as u", "ar.user_id", "u.user_id")
                    .leftJoin("departments as d", "u.dept_id", "d.dept_id")
                    .select("u.user_name", "d.dept_name", "ar.time_in", "ar.time_out", "ar.status")
                    .where("ar.org_id", org_id)
                    .whereRaw("DATE(ar.time_in) >= ?", [startDate])
                    .whereRaw("DATE(ar.time_in) <= ?", [endDate])
                    .orderBy("ar.time_in", "asc");
                pdfRows = detailedRecords.map(r => [
                    r.user_name,
                    r.dept_name || "-",
                    r.time_in ? new Date(r.time_in).toLocaleTimeString() : "-",
                    r.time_out ? new Date(r.time_out).toLocaleTimeString() : "-",
                    calculateWorkHours(r.time_in, r.time_out),
                    r.status
                ]);
            } else {
                pdfRows = users.map(u => {
                    const rec = records.find(r => r.user_id === u.user_id);
                    return [
                        u.user_name,
                        u.dept_name || "-",
                        rec?.time_in ? new Date(rec.time_in).toLocaleTimeString() : "-",
                        rec?.time_out ? new Date(rec.time_out).toLocaleTimeString() : "-",
                        calculateWorkHours(rec?.time_in, rec?.time_out),
                        rec?.status || "Absent"
                    ];
                });
            }
        } else if (type === "lateness_report") {
            pdfCols = ["Name", "Dept", "Date", "Late (Mins)", "Overtime (Mins)"];
            const latenessRecords = await knexDB("attendance_records as ar")
                .join("users as u", "ar.user_id", "u.user_id")
                .leftJoin("departments as d", "u.dept_id", "d.dept_id")
                .select("u.user_name", "d.dept_name", "ar.time_in", "ar.late_minutes", "ar.overtime_hours")
                .where("ar.org_id", org_id)
                .whereRaw("DATE(ar.time_in) >= ?", [startDate])
                .whereRaw("DATE(ar.time_in) <= ?", [endDate])
                .where(builder => builder.where("ar.late_minutes", ">", 0).orWhere("ar.overtime_hours", ">", 0));
            pdfRows = latenessRecords.map(r => [
                r.user_name,
                r.dept_name || "-",
                new Date(r.time_in).toLocaleDateString(),
                r.late_minutes || 0,
                r.overtime_hours || 0
            ]);
        } else if (type === "employee_master") {
            pdfCols = ["ID", "Name", "Email", "Phone", "Dept"];
            pdfRows = users.map(u => [
                u.user_id,
                u.user_name,
                u.email || "-",
                u.phone_no || "-",
                u.dept_name || "-"
            ]);
        } else {
            pdfCols = ["Name", "Dept", "Present", "Total Hrs", "Late"];
            pdfRows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const totalHrs = userRecs.reduce((sum, r) => sum + parseFloat(calculateWorkHours(r.time_in, r.time_out)), 0);
                return [
                    u.user_name,
                    u.dept_name || "-",
                    userRecs.length,
                    totalHrs.toFixed(2),
                    userRecs.filter(r => r.late_minutes > 0).length
                ];
            });
        }

        const pdfDoc = generatePdf(pdfTitle, pdfCols, pdfRows);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=report.pdf");

        pdfDoc.pipe(res);
        pdfDoc.end();
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");

    if (type === "matrix_daily") {
        worksheet.columns = [
            { header: "Name", key: "name", width: 25 },
            { header: "Department", key: "dept", width: 20 },
            { header: "Time In", key: "time_in", width: 15 },
            { header: "Time Out", key: "time_out", width: 15 },
            { header: "Work Hours", key: "work_hrs", width: 12 },
            { header: "Status", key: "status", width: 15 }
        ];
        users.forEach(u => {
            const rec = records.find(r => r.user_id === u.user_id);
            worksheet.addRow({
                name: u.user_name,
                dept: u.dept_name || "General",
                time_in: rec?.time_in ? new Date(rec.time_in).toLocaleTimeString() : "-",
                time_out: rec?.time_out ? new Date(rec.time_out).toLocaleTimeString() : "-",
                work_hrs: calculateWorkHours(rec?.time_in, rec?.time_out),
                status: rec?.status || "Absent"
            });
        });
    } else if (type === "attendance_detailed") {
        worksheet.columns = [
            { header: "Date", key: "date", width: 15 },
            { header: "Name", key: "name", width: 25 },
            { header: "Dept", key: "dept", width: 20 },
            { header: "Time In", key: "time_in", width: 15 },
            { header: "Time Out", key: "time_out", width: 15 },
            { header: "Work Hrs", key: "work_hrs", width: 12 },
            { header: "Status", key: "status", width: 15 }
        ];
        const detailedRecords = await knexDB("attendance_records as ar")
            .join("users as u", "ar.user_id", "u.user_id")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .select("ar.time_in", "u.user_name", "d.dept_name", "ar.time_out", "ar.status")
            .where("ar.org_id", org_id)
            .whereRaw("DATE(ar.time_in) >= ?", [startDate])
            .whereRaw("DATE(ar.time_in) <= ?", [endDate])
            .orderBy("ar.time_in", "asc");

        detailedRecords.forEach(r => {
            worksheet.addRow({
                date: new Date(r.time_in).toLocaleDateString(),
                name: r.user_name,
                dept: r.dept_name || "-",
                time_in: r.time_in ? new Date(r.time_in).toLocaleTimeString() : "-",
                time_out: r.time_out ? new Date(r.time_out).toLocaleTimeString() : "-",
                work_hrs: calculateWorkHours(r.time_in, r.time_out),
                status: r.status
            });
        });
    } else if (type === "attendance_summary") {
        worksheet.columns = [
            { header: "Name", key: "name", width: 25 },
            { header: "Dept", key: "dept", width: 20 },
            { header: "Total Days", key: "total", width: 15 },
            { header: "Present", key: "present", width: 15 }
        ];
        const summaryRecords = await knexDB("attendance_records as ar")
            .join("users as u", "ar.user_id", "u.user_id")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .select("u.user_name", "d.dept_name")
            .count("ar.record_id as total_days")
            .sum(knexDB.raw("CASE WHEN ar.status = 'PRESENT' THEN 1 ELSE 0 END as present_days"))
            .where("ar.org_id", org_id)
            .whereRaw("DATE(ar.time_in) >= ?", [startDate])
            .whereRaw("DATE(ar.time_in) <= ?", [endDate])
            .groupBy("u.user_id");

        summaryRecords.forEach(r => {
            worksheet.addRow({
                name: r.user_name,
                dept: r.dept_name || "-",
                total: r.total_days,
                present: r.present_days
            });
        });
    } else if (type === "lateness_report") {
        worksheet.columns = [
            { header: "Name", key: "name", width: 25 },
            { header: "Dept", key: "dept", width: 20 },
            { header: "Date", key: "date", width: 15 },
            { header: "Late (Mins)", key: "late", width: 15 },
            { header: "Overtime (Mins)", key: "ot", width: 15 }
        ];
        const latenessRecords = await knexDB("attendance_records as ar")
            .join("users as u", "ar.user_id", "u.user_id")
            .leftJoin("departments as d", "u.dept_id", "d.dept_id")
            .select("u.user_name", "d.dept_name", "ar.time_in", "ar.late_minutes", "ar.overtime_hours")
            .where("ar.org_id", org_id)
            .whereRaw("DATE(ar.time_in) >= ?", [startDate])
            .whereRaw("DATE(ar.time_in) <= ?", [endDate])
            .where(builder => builder.where("ar.late_minutes", ">", 0).orWhere("ar.overtime_hours", ">", 0));

        latenessRecords.forEach(r => {
            worksheet.addRow({
                name: r.user_name,
                dept: r.dept_name || "-",
                date: new Date(r.time_in).toLocaleDateString(),
                late: r.late_minutes || 0,
                ot: r.overtime_hours || 0
            });
        });
    } else if (type === "employee_master") {
        worksheet.columns = [
            { header: "ID", key: "id", width: 10 },
            { header: "Name", key: "name", width: 25 },
            { header: "Email", key: "email", width: 30 },
            { header: "Phone", key: "phone", width: 15 },
            { header: "Department", key: "dept", width: 20 },
            { header: "Designation", key: "desg", width: 20 },
            { header: "Role", key: "role", width: 15 }
        ];
        users.forEach(u => {
            worksheet.addRow({
                id: u.user_id,
                name: u.user_name,
                email: u.email || "-",
                phone: u.phone_no || "-",
                dept: u.dept_name || "-",
                desg: u.desg_name || "-",
                role: u.user_type
            });
        });
    } else {
        // Multi-day Matrix
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dateHeaders = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dateHeaders.push(new Date(d));
        }

        const baseHeaders = ["SR No.", "Name", "Position", "Dept"];
        const timeHeaders = ["Time In", "Time Out", "Late Hours"];
        const gridHeaders = dateHeaders.map(d => `${d.getDate()}\n${d.toLocaleDateString('en-US', { weekday: 'short' })}`);
        const summaryHeaders = ["Present Days", "Total Hrs", "Late Count", "Late Mins"];

        worksheet.addRow([...baseHeaders, ...timeHeaders, ...gridHeaders, ...summaryHeaders]);
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        users.forEach((u, index) => {
            const userRecs = records.filter(r => r.user_id === u.user_id);

            // Calculate latest time in, time out, and total late hours
            let latestTimeIn = "-";
            let latestTimeOut = "-";
            let totalLateHours = 0;

            if (userRecs.length > 0) {
                const latestRec = userRecs.reduce((latest, rec) => {
                    return new Date(rec.time_in) > new Date(latest.time_in) ? rec : latest;
                });

                latestTimeIn = latestRec.time_in ? new Date(latestRec.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
                latestTimeOut = latestRec.time_out ? new Date(latestRec.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";

                totalLateHours = userRecs.reduce((sum, r) => sum + (r.late_minutes || 0), 0) / 60;
            }

            const userRow = [
                index + 1,
                u.user_name,
                u.desg_name || "-",
                u.dept_name || "-",
                latestTimeIn,
                latestTimeOut,
                totalLateHours.toFixed(2)
            ];

            let totalHrs = 0;
            let lateCount = 0;
            let lateMins = 0;

            dateHeaders.forEach(d => {
                const dateStr = d.toISOString().split('T')[0];
                const rec = userRecs.find(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                if (rec) {
                    userRow.push("1.0");
                    totalHrs += parseFloat(calculateWorkHours(rec.time_in, rec.time_out));
                    if (rec.late_minutes > 0) {
                        lateCount++;
                        lateMins += rec.late_minutes;
                    }
                } else {
                    const day = d.getDay();
                    userRow.push(day === 0 ? "Sun" : day === 6 ? "Sat" : "0.0");
                }
            });

            userRow.push(userRecs.length, totalHrs.toFixed(2), lateCount, lateMins);
            const row = worksheet.addRow(userRow);
            row.eachCell((cell, colNum) => {
                if (cell.value === "0.0") cell.font = { color: { argb: 'FFFF0000' } };
                if (cell.value === "Sun" || cell.value === "Sat") cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            });
        });
    }

    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Report_${type}.${format}`);
    if (format === "csv") await workbook.csv.write(res);
    else await workbook.xlsx.write(res);
    res.end();
}));

export default router;