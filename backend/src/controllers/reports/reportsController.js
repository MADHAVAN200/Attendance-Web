import catchAsync from '../../utils/catchAsync.js';
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import * as reportsService from '../../services/reports/reportsServices.js';

// Helper: Generate PDF using PDFKit with a professional grid/table design
const generatePdf = (title, columns, rows) => {
    const doc = new PDFDocument({
        size: 'A4',
        layout: columns.length > 7 ? 'landscape' : 'portrait',
        margin: 40,
        bufferPages: true,
        autoPageBreak: false
    });

    const margin = 40;
    const pageWidth = doc.page.width - (margin * 2);
    const cellPadding = 6;
    const headerHeight = 28;
    const rowHeight = 22;

    // Beautiful Title Header Banner
    doc.rect(margin, 30, pageWidth, 45).fill('#1F4E78');
    doc.fillColor('#FFFFFF')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text(title.toUpperCase(), margin + 15, 45, { align: 'left' });
       
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#A3BFFA')
       .text(`Generated on: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, margin + 15, 62, { align: 'left' });

    doc.moveDown(3.5);
    let currentY = doc.y;

    const drawLine = (y) => {
        doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke('#E2E8F0');
    };

    const drawVerticalLines = (y, height) => {
        for (let i = 0; i <= columns.length; i++) {
            doc.moveTo(margin + (i * colWidth), y)
                .lineTo(margin + (i * colWidth), y + height)
                .stroke('#E2E8F0');
        }
    };

    const colWidth = pageWidth / columns.length;

    // Draw Table Header
    doc.rect(margin, currentY, pageWidth, headerHeight).fill('#2A4D69');
    doc.fillColor('#FFFFFF');
    doc.fontSize(9).font('Helvetica-Bold');
    columns.forEach((col, i) => {
        doc.text(col, margin + (i * colWidth) + cellPadding, currentY + (headerHeight / 2) - 4, {
            width: colWidth - (cellPadding * 2),
            align: 'center'
        });
    });

    drawLine(currentY);
    drawLine(currentY + headerHeight);
    drawVerticalLines(currentY, headerHeight);
    currentY += headerHeight;

    // Draw Table Body
    doc.fontSize(8).font('Helvetica');
    rows.forEach((row, rowIndex) => {
        if (currentY + rowHeight > doc.page.height - 60) {
            doc.addPage({
                size: 'A4',
                layout: columns.length > 7 ? 'landscape' : 'portrait',
                margin: 40
            });
            currentY = margin + 20;

            // Draw header again on new page
            doc.rect(margin, currentY, pageWidth, headerHeight).fill('#2A4D69');
            doc.fillColor('#FFFFFF');
            doc.fontSize(9).font('Helvetica-Bold');
            columns.forEach((col, i) => {
                doc.text(col, margin + (i * colWidth) + cellPadding, currentY + (headerHeight / 2) - 4, {
                    width: colWidth - (cellPadding * 2),
                    align: 'center'
                });
            });
            drawLine(currentY);
            drawLine(currentY + headerHeight);
            drawVerticalLines(currentY, headerHeight);
            currentY += headerHeight;
            doc.fontSize(8).font('Helvetica');
        }

        // Zebra striping
        if (rowIndex % 2 === 0) {
            doc.rect(margin, currentY, pageWidth, rowHeight).fill('#F8FAFC');
        }

        row.forEach((cell, i) => {
            const cellText = cell?.toString() || "-";
            
            // Default text color
            let textColor = '#2D3748';
            let fontStyle = 'Helvetica';

            // Conditional text coloring for statuses in PDF
            if (cellText === 'Present' || cellText === '1.0') {
                textColor = '#137333';
                fontStyle = 'Helvetica-Bold';
            } else if (cellText === 'Absent' || cellText === '0.0') {
                textColor = '#C5221F';
                fontStyle = 'Helvetica-Bold';
            } else if (cellText?.toLowerCase().includes('late') || cellText?.toLowerCase().includes('overtime')) {
                textColor = '#B06000';
                fontStyle = 'Helvetica-Bold';
            } else if (cellText === 'Sun' || cellText === 'Sat') {
                textColor = '#718096';
                fontStyle = 'Helvetica-Bold';
            }

            doc.fillColor(textColor).font(fontStyle);
            doc.text(cellText, margin + (i * colWidth) + cellPadding, currentY + (rowHeight / 2) - 4, {
                width: colWidth - (cellPadding * 2),
                align: 'center',
                lineBreak: false,
                ellipsis: true
            });
        });

        drawLine(currentY + rowHeight);
        drawVerticalLines(currentY, rowHeight);
        currentY += rowHeight;
    });

    // Page number footer pass
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        // Draw thin page footer line
        doc.moveTo(margin, doc.page.height - 35)
           .lineTo(doc.page.width - margin, doc.page.height - 35)
           .stroke('#E2E8F0');

        doc.fontSize(7)
           .fillColor('#718096')
           .font('Helvetica')
           .text(
               `Page ${i + 1} of ${range.count}`,
               margin,
               doc.page.height - 25,
               { align: 'right' }
           );
           
        doc.text(
            `MANO Attendance & Operations Report  |  Confidential`,
            margin,
            doc.page.height - 25,
            { align: 'left' }
        );
    }

    return doc;
};

// Helper: Convert column index (1-based) to Excel column letter (e.g. 1 -> A, 27 -> AA)
const getColLetter = (col) => {
    let letter = "";
    while (col > 0) {
        let temp = (col - 1) % 26;
        letter = String.fromCharCode(65 + temp) + letter;
        col = Math.floor((col - temp) / 26);
    }
    return letter;
};

// Helper: Style Excel Worksheet beautifully
const styleExcelWorksheet = (worksheet, type) => {
    // 1. Enable Gridlines
    worksheet.views = [{ showGridLines: true }];

    const isMultiDayMatrix = ['matrix_monthly', 'matrix_weekly'].includes(type);
    const headerRowsCount = isMultiDayMatrix ? 2 : 1;

    // 2. Style Header Rows (Row 1 & Row 2 if multi-day)
    for (let rowNum = 1; rowNum <= headerRowsCount; rowNum++) {
        const headerRow = worksheet.getRow(rowNum);
        headerRow.height = isMultiDayMatrix ? 26 : 32;
        
        headerRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = {
                name: 'Segoe UI',
                size: 10,
                bold: true,
                color: { argb: 'FFFFFFFF' }
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F4E78' } // Premium Navy Blue
            };
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF122F4A' } },
                bottom: { style: 'thin', color: { argb: 'FF122F4A' } },
                left: { style: 'thin', color: { argb: 'FF3A6085' } },
                right: { style: 'thin', color: { argb: 'FF3A6085' } }
            };
        });
    }

    // 3. Style Data Rows (Row 3 onwards for multi-day, Row 2 onwards for others)
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowsCount) return; // Skip headers

        let hasMultiline = false;
        row.eachCell((cCell) => {
            if (cCell.value?.toString().includes('\n')) {
                hasMultiline = true;
            }
        });
        row.height = hasMultiline ? 52 : 24;
        const isEven = (rowNumber % 2 === 0);

        const firstCellVal = row.getCell(1).value?.toString() || '';
        const isTotalsRow = ['totals', 'total late mins'].some(k => firstCellVal.toLowerCase().includes(k));

        row.eachCell((cell, colNumber) => {
            if (isTotalsRow) {
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FF1F4E78' } // Premium Navy Blue text
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F4F7' } // Light Grey background
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF1F4E78' } },
                    bottom: { style: 'double', color: { argb: 'FF1F4E78' } }, // Accounting double underline
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center'
                };
                const r1Header = worksheet.getRow(1).getCell(colNumber).value?.toString().toLowerCase() || '';
                const r2Header = isMultiDayMatrix ? (worksheet.getRow(2).getCell(colNumber).value?.toString().toLowerCase() || '') : '';
                const colHeader = `${r1Header} ${r2Header}`;
                if (['name', 'department', 'dept', 'employee', 'reason'].some(k => colHeader.includes(k))) {
                    cell.alignment.horizontal = 'left';
                }
                return; // Skip normal styling for Totals row
            }

            // Default font and borders
            cell.font = {
                name: 'Segoe UI',
                size: 10,
                color: { argb: 'FF333333' }
            };

            // Zebra striping
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' }
            };

            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            // Alignment based on column headers and types
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center'
            };

            // Combine both header rows to check column content type
            const r1Header = worksheet.getRow(1).getCell(colNumber).value?.toString().toLowerCase() || '';
            const r2Header = isMultiDayMatrix ? (worksheet.getRow(2).getCell(colNumber).value?.toString().toLowerCase() || '') : '';
            const colHeader = `${r1Header} ${r2Header}`;
            if (['name', 'department', 'dept', 'employee', 'reason', 'in location', 'out location', 'email', 'phone', 'role', 'designation', 'position'].some(k => colHeader.includes(k))) {
                cell.alignment.horizontal = 'left';
            }

            // 4. Conditional Formatting based on cell values
            const val = cell.value?.toString().trim();
            
            // Present or 1.0 status (Green)
            if (val === 'Present' || val === '1.0') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE6F4EA' } // Soft Green
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FF137333' } // Dark Green
                };
            }
            // Absent or 0.0 status (Red)
            else if (val === 'Absent' || val === '0.0') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFCE8E6' } // Soft Red
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FFC5221F' } // Dark Red
                };
            }
            // Late or Late Minutes/Count > 0 (Orange)
            else if (val?.toLowerCase().includes('late') || (colHeader.includes('late') && Number(val) > 0)) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFEF7E0' } // Soft Orange/Yellow
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FFB06000' } // Dark Orange/Brown
                };
            }
            // Weekend Sat/Sun (Lavender)
            else if (val === 'Sun' || val === 'Sat') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF1F3F4' } // Soft Grey/Lavender
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FF5F6368' }
                };
            }
            // Leaves status
            else if (val?.toLowerCase() === 'on leave' || val?.toLowerCase() === 'leave' || val?.toLowerCase() === 'half day') {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE8F0FE' } // Soft Blue
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FF1A73E8' }
                };
            }
        });
    });

    // 5. Dynamic Auto-fit Columns (with a padding)
    const colCount = worksheet.columnCount;
    for (let c = 1; c <= colCount; c++) {
        const col = worksheet.getColumn(c);
        let maxLen = 0;
        col.eachCell({ includeEmpty: true }, cell => {
            const cellVal = cell.value ? cell.value.toString() : '';
            const lines = cellVal.split('\n');
            lines.forEach(l => {
                maxLen = Math.max(maxLen, l.length);
            });
        });
        col.width = Math.max(maxLen + 4, 12);
    }
};

export const previewReport = catchAsync(async (req, res) => {
    if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    const { month, date, type } = req.query;
    const org_id = req.user.org_id;

    if (!type) {
        return res.status(400).json({ ok: false, message: "Report type is required" });
    }

    if (["matrix_monthly", "attendance_summary", "attendance_detailed"].includes(type) && !month) {
        return res.status(400).json({ ok: false, message: "Month is required" });
    }

    if (["matrix_weekly", "matrix_daily"].includes(type) && !date) {
        return res.status(400).json({ ok: false, message: "Date is required" });
    }

    const { startDate, endDate } = reportsService.resolveDateRange({ type, month, date });
    const data = await reportsService.getPreviewData({ type, org_id, month, startDate, endDate });

    res.json({ ok: true, data });
});

export const downloadReport = catchAsync(async (req, res) => {
    const { month, date, type, format = "xlsx" } = req.query;
    const org_id = req.user.org_id;
    const isUserReport = req.originalUrl.includes("/attendance/");
    const targetUserId = isUserReport ? req.user.user_id : req.query.user_id;

    if (!type) {
        return res.status(400).json({ ok: false, message: "Report Type is required" });
    }

    if (["matrix_monthly", "attendance_summary", "attendance_detailed"].includes(type) && !month) {
        return res.status(400).json({ ok: false, message: "Month is required" });
    }

    if (["matrix_weekly", "matrix_daily"].includes(type) && !date) {
        return res.status(400).json({ ok: false, message: "Date is required" });
    }

    const { startDate, endDate } = reportsService.resolveDateRange({ type, month, date });

    const users = await reportsService.getUsers({ org_id, targetUserId });
    let records = [];
    if (type !== "employee_master") {
        records = await reportsService.getAttendanceRecords({ org_id, startDate, endDate });
    }

    if (format === "pdf") {
        let pdfTitle = type === "employee_master" ? "Employee Master Data" : `Attendance Report - ${startDate} to ${endDate}`;
        let pdfCols, pdfRows;

        if (type === "attendance_detailed") {
            const detailedRecords = await reportsService.getDetailedRecords({ org_id, startDate, endDate });
            pdfCols = ["Date", "Name", "Dept", "Shift", "In Time", "Out Time", "Work Hrs", "Status", "In Location", "Out Location"];
            pdfRows = detailedRecords.map(r => [
                new Date(r.time_in).toLocaleDateString(),
                r.user_name,
                r.dept_name || "-",
                r.shift_name || "-",
                r.time_in ? new Date(r.time_in).toLocaleTimeString() : "-",
                r.time_out ? new Date(r.time_out).toLocaleTimeString() : "-",
                reportsService.calculateWorkHours(r.time_in, r.time_out),
                reportsService.deriveStatus(r),
                r.time_in_address || "-",
                r.time_out_address || "-"
            ]);
        } else if (type === "matrix_daily") {
            pdfCols = ["Name", "Dept", "In Time", "Out Time", "Work Hrs", "Status", "In Location", "Out Location"];
            pdfRows = users.map(u => {
                const rec = records.find(r => r.user_id === u.user_id);
                return [
                    u.user_name,
                    u.dept_name || "-",
                    rec?.time_in ? new Date(rec.time_in).toLocaleTimeString() : "-",
                    rec?.time_out ? new Date(rec.time_out).toLocaleTimeString() : "-",
                    reportsService.calculateWorkHours(rec?.time_in, rec?.time_out),
                    rec?.status || "Absent",
                    rec?.time_in_address || "-",
                    rec?.time_out_address || "-"
                ];
            });

        } else if (type === "employee_master") {
            pdfCols = ["Name", "Email", "Phone", "Dept", "Designation", "Role"];
            pdfRows = users.map(u => [u.user_name, u.email || "-", u.phone_no || "-", u.dept_name || "-", u.desg_name || "-", u.user_type || "-"]);
        } else {
            pdfCols = ["Name", "Dept", "Total Days", "Present", "Absent", "Half Day", "Leave", "Late Days", "Late Mins", "OT Hrs", "Total Hrs", "Payable Days"];
            const [year, monthNum] = month.split("-").map(Number);
            const totalDaysInMonth = new Date(year, monthNum, 0).getDate();
            pdfRows = users.map(u => {
                const userRecs = records.filter(r => r.user_id === u.user_id);
                const presentDays = userRecs.filter(r => r.time_in && r.status !== 'ABSENT' && r.status !== 'ON_LEAVE').length;
                const halfDayCount = userRecs.filter(r => r.status === 'HALF_DAY').length;
                const leaveCount = userRecs.filter(r => r.status === 'ON_LEAVE').length;
                const absentDays = Math.max(0, totalDaysInMonth - (presentDays + leaveCount));
                const lateCount = userRecs.filter(r => r.late_minutes > 0).length;
                const totalLateMins = userRecs.reduce((sum, r) => sum + (r.late_minutes || 0), 0);
                const totalOvertimeHrs = userRecs.reduce((sum, r) => sum + parseFloat(r.overtime_hours || 0), 0);
                const totalHrs = userRecs.reduce((sum, r) => {
                    const start = new Date(r.time_in);
                    const end = r.time_out ? new Date(r.time_out) : null;
                    if (start && end) return sum + (end - start) / (1000 * 60 * 60);
                    return sum;
                }, 0);
                const payableDays = presentDays - (0.5 * halfDayCount) + leaveCount;
                return [
                    u.user_name,
                    u.dept_name || "-",
                    totalDaysInMonth,
                    presentDays,
                    absentDays,
                    halfDayCount,
                    leaveCount,
                    lateCount,
                    totalLateMins,
                    totalOvertimeHrs.toFixed(2),
                    totalHrs.toFixed(2),
                    Math.round(payableDays).toFixed(0)
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

    // Excel / CSV
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");

    if (type === "matrix_daily") {
        worksheet.columns = [
            { header: "Name", key: "name", width: 25 },
            { header: "Department", key: "dept", width: 20 },
            { header: "Time In", key: "time_in", width: 15 },
            { header: "Time Out", key: "time_out", width: 15 },
            { header: "Work Hours", key: "work_hrs", width: 12 },
            { header: "Status", key: "status", width: 15 },
            { header: "In Location", key: "time_in_address", width: 40 },
            { header: "Out Location", key: "time_out_address", width: 40 }
        ];
        users.forEach(u => {
            const rec = records.find(r => r.user_id === u.user_id);
            worksheet.addRow({
                name: u.user_name,
                dept: u.dept_name || "General",
                time_in: rec?.time_in ? new Date(rec.time_in).toLocaleTimeString() : "-",
                time_out: rec?.time_out ? new Date(rec.time_out).toLocaleTimeString() : "-",
                work_hrs: reportsService.calculateWorkHours(rec?.time_in, rec?.time_out),
                status: rec?.status || "Absent",
                time_in_address: rec?.time_in_address || "-",
                time_out_address: rec?.time_out_address || "-"
            });
        });

        const lastRow = worksheet.rowCount;
        worksheet.addRow({
            name: "TOTALS",
            dept: "",
            time_in: "",
            time_out: "",
            work_hrs: { formula: `SUM(E2:E${lastRow})` },
            status: "",
            time_in_address: "",
            time_out_address: ""
        });
    } else if (type === "attendance_detailed") {
        worksheet.columns = [
            { header: "Date", key: "date", width: 15 },
            { header: "Name", key: "name", width: 25 },
            { header: "Department", key: "dept", width: 20 },
            { header: "Shift", key: "shift", width: 15 },
            { header: "Time In", key: "time_in", width: 15 },
            { header: "Time Out", key: "time_out", width: 15 },
            { header: "Work Hrs", key: "work_hrs", width: 12 },
            { header: "Status", key: "status", width: 15 },
            { header: "In Location", key: "time_in_address", width: 40 },
            { header: "Out Location", key: "time_out_address", width: 40 }
        ];
        const detailedRecords = await reportsService.getDetailedRecords({ org_id, startDate, endDate });
        detailedRecords.forEach(r => {
            worksheet.addRow({
                date: new Date(r.time_in).toLocaleDateString(),
                user_id: r.user_id,
                name: r.user_name,
                dept: r.dept_name || "-",
                shift: r.shift_name || "-",
                time_in: r.time_in ? new Date(r.time_in).toLocaleTimeString() : "-",
                time_out: r.time_out ? new Date(r.time_out).toLocaleTimeString() : "-",
                work_hrs: reportsService.calculateWorkHours(r.time_in, r.time_out),
                status: reportsService.deriveStatus(r),
                time_in_address: r.time_in_address || "-",
                time_out_address: r.time_out_address || "-"
            });
        });
    } else if (type === "attendance_summary") {
        worksheet.columns = [
            { header: "Name", key: "name", width: 25 },
            { header: "Dept", key: "dept", width: 20 },
            { header: "Total Days", key: "total_days", width: 12 },
            { header: "Present", key: "present", width: 10 },
            { header: "Absent", key: "absent", width: 10 },
            { header: "Half Day", key: "half_day", width: 10 },
            { header: "On Leave", key: "leaves", width: 10 },
            { header: "Late Days", key: "late_days", width: 12 },
            { header: "Late Mins", key: "late_mins", width: 12 },
            { header: "Overtime Hrs", key: "overtime_hrs", width: 15 },
            { header: "Total Hrs", key: "total_hrs", width: 12 },
            { header: "Payable Days", key: "payable_days", width: 15 }
        ];
        const [year, monthNum] = month.split("-").map(Number);
        const totalDaysInMonth = new Date(year, monthNum, 0).getDate();
        users.forEach(u => {
            const userRecs = records.filter(r => r.user_id === u.user_id);
            const presentDays = userRecs.filter(r => r.time_in && r.status !== 'ABSENT' && r.status !== 'ON_LEAVE').length;
            const halfDayCount = userRecs.filter(r => r.status === 'HALF_DAY').length;
            const leaveCount = userRecs.filter(r => r.status === 'ON_LEAVE').length;
            const absentDays = Math.max(0, totalDaysInMonth - (presentDays + leaveCount));
            const lateCount = userRecs.filter(r => r.late_minutes > 0).length;
            const totalLateMins = userRecs.reduce((sum, r) => sum + (r.late_minutes || 0), 0);
            const totalOvertimeHrs = userRecs.reduce((sum, r) => sum + parseFloat(r.overtime_hours || 0), 0);
            const totalHrs = userRecs.reduce((sum, r) => {
                const start = new Date(r.time_in);
                const end = r.time_out ? new Date(r.time_out) : null;
                if (start && end) return sum + (end - start) / (1000 * 60 * 60);
                return sum;
            }, 0);
            const payableDays = presentDays - (0.5 * halfDayCount) + leaveCount;
            
            worksheet.addRow({
                id: u.user_id,
                name: u.user_name,
                dept: u.dept_name || "-",
                total_days: totalDaysInMonth,
                present: presentDays,
                absent: absentDays,
                half_day: halfDayCount,
                leaves: leaveCount,
                late_days: lateCount,
                late_mins: totalLateMins,
                overtime_hrs: totalOvertimeHrs.toFixed(2),
                total_hrs: totalHrs.toFixed(2),
                payable_days: Math.round(payableDays)
            });
        });

        const lastRow = worksheet.rowCount;
        worksheet.addRow({
            name: "TOTALS",
            dept: "",
            total_days: "",
            present: { formula: `SUM(D2:D${lastRow})` },
            absent: { formula: `SUM(E2:E${lastRow})` },
            half_day: { formula: `SUM(F2:F${lastRow})` },
            leaves: { formula: `SUM(G2:G${lastRow})` },
            late_days: { formula: `SUM(H2:H${lastRow})` },
            late_mins: { formula: `SUM(I2:I${lastRow})` },
            overtime_hrs: { formula: `SUM(J2:J${lastRow})` },
            total_hrs: { formula: `SUM(K2:K${lastRow})` },
            payable_days: { formula: `SUM(L2:L${lastRow})` }
        });

    } else if (type === "employee_master") {
        worksheet.columns = [
            { header: "Name", key: "name", width: 25 },
            { header: "Email", key: "email", width: 30 },
            { header: "Phone", key: "phone", width: 15 },
            { header: "Department", key: "dept", width: 20 },
            { header: "Designation", key: "desg", width: 20 },
            { header: "Role", key: "user_type", width: 15 }
        ];
        users.forEach(u => {
            worksheet.addRow({
                name: u.user_name,
                email: u.email || "-",
                phone: u.phone_no || "-",
                dept: u.dept_name || "-",
                desg: u.desg_name || "-",
                user_type: u.user_type
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
        const summaryHeaders = ["Present Days", "Total Hrs", "Late Count", "Late Mins"];

        // Add Row 1
        const row1 = [...baseHeaders, ...timeHeaders];
        dateHeaders.forEach(d => {
            const datePrefix = `${d.getDate()} ${d.toLocaleDateString('en-US', { weekday: 'short' })}`;
            row1.push(datePrefix, "", "", ""); // horizontal merge padding cells
        });
        row1.push(...summaryHeaders);
        worksheet.addRow(row1);

        // Add Row 2
        const row2 = ["", "", "", "", "", "", ""]; // 7 vertically merged placeholders
        dateHeaders.forEach(() => {
            row2.push("In Time", "Out Time", "In Location", "Out Location");
        });
        row2.push("", "", "", ""); // 4 vertically merged placeholders
        worksheet.addRow(row2);

        // Apply Excel merges:
        // 1. Vertically merge base & time headers (Columns 1 to 7)
        for (let col = 1; col <= 7; col++) {
            worksheet.mergeCells(1, col, 2, col);
        }

        // 2. Horizontally merge dates in Row 1
        for (let dIdx = 0; dIdx < dateHeaders.length; dIdx++) {
            const startCol = 8 + 4 * dIdx;
            const endCol = startCol + 3;
            worksheet.mergeCells(1, startCol, 1, endCol);
        }

        // 3. Vertically merge summary headers at the end
        const summaryStartCol = 8 + 4 * dateHeaders.length;
        for (let col = summaryStartCol; col < summaryStartCol + 4; col++) {
            worksheet.mergeCells(1, col, 2, col);
        }

        users.forEach((u, index) => {
            const userRecs = records.filter(r => r.user_id === u.user_id);

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

            const userRow = [index + 1, u.user_name, u.desg_name || "-", u.dept_name || "-", latestTimeIn, latestTimeOut, totalLateHours.toFixed(2)];

            let totalHrs = 0;
            let lateCount = 0;
            let lateMins = 0;

            dateHeaders.forEach(d => {
                const dateStr = d.toISOString().split('T')[0];
                const rec = userRecs.find(r => new Date(r.time_in).toISOString().split('T')[0] === dateStr);
                if (rec) {
                    const checkInTime = rec.time_in ? new Date(rec.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
                    const checkOutTime = rec.time_out ? new Date(rec.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
                    const locationIn = rec.time_in_address || "-";
                    const locationOut = rec.time_out_address || "-";
                    userRow.push(checkInTime, checkOutTime, locationIn, locationOut);

                    totalHrs += parseFloat(reportsService.calculateWorkHours(rec.time_in, rec.time_out));
                    if (rec.late_minutes > 0) {
                        lateCount++;
                        lateMins += rec.late_minutes;
                    }
                } else {
                    const day = d.getDay();
                    const statusStr = day === 0 ? "Sun" : day === 6 ? "Sat" : "Absent";
                    userRow.push(statusStr, "-", "-", "-");
                }
            });

            userRow.push(userRecs.length, totalHrs.toFixed(2), lateCount, lateMins);
            const row = worksheet.addRow(userRow);
            row.eachCell((cell) => {
                if (cell.value === "Absent") cell.font = { color: { argb: 'FFFF0000' } };
                if (cell.value === "Sun" || cell.value === "Sat") cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            });
        });

        const lastRow = worksheet.rowCount;
        const totalRowValues = [];
        totalRowValues[0] = "TOTALS";
        totalRowValues[1] = "";
        totalRowValues[2] = "";
        totalRowValues[3] = "";
        totalRowValues[4] = "";
        totalRowValues[5] = "";
        
        // Late Hours sum (Col G / Col 7, data starts at Row 3)
        totalRowValues[6] = { formula: `SUM(G3:G${lastRow})` };

        // For date columns (base offset is col 8, 1-based, starts at Row 3)
        for (let dIdx = 0; dIdx < dateHeaders.length; dIdx++) {
            const baseColIdx = 8 + 4 * dIdx;
            const letter = getColLetter(baseColIdx);
            
            // Present count formula for In Time column of the date
            totalRowValues[baseColIdx - 1] = { 
                formula: `COUNTIFS(${letter}3:${letter}${lastRow}, "<>-", ${letter}3:${letter}${lastRow}, "<>Absent", ${letter}3:${letter}${lastRow}, "<>Sun", ${letter}3:${letter}${lastRow}, "<>Sat")` 
            };
            
            // Blank columns in Out Time, In Location, and Out Location for the totals row
            totalRowValues[baseColIdx] = "";
            totalRowValues[baseColIdx + 1] = "";
            totalRowValues[baseColIdx + 2] = "";
        }

        // Summary columns (starts at Row 3)
        const presCol = summaryStartCol;
        totalRowValues[presCol - 1] = { formula: `SUM(${getColLetter(presCol)}3:${getColLetter(presCol)}${lastRow})` };

        const hrsCol = summaryStartCol + 1;
        totalRowValues[hrsCol - 1] = { formula: `SUM(${getColLetter(hrsCol)}3:${getColLetter(hrsCol)}${lastRow})` };

        const countCol = summaryStartCol + 2;
        totalRowValues[countCol - 1] = { formula: `SUM(${getColLetter(countCol)}3:${getColLetter(countCol)}${lastRow})` };

        const minsCol = summaryStartCol + 3;
        totalRowValues[minsCol - 1] = { formula: `SUM(${getColLetter(minsCol)}3:${getColLetter(minsCol)}${lastRow})` };

        worksheet.addRow(totalRowValues);
    }

    if (format === "xlsx") {
        styleExcelWorksheet(worksheet, type);
    }

    res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Report_${type}.${format}`);
    if (format === "csv") await workbook.csv.write(res);
    else await workbook.xlsx.write(res);
    res.end();
});