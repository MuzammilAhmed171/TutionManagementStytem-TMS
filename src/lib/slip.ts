import type { DataState, FeeRecord, Payment, Settings } from "../types";
import { balanceOf, challanNo, chargeOf, paidOf, previousBalance, statusOf, studentPaidToDate } from "./fee";
import { fmtDate, fmtMoney, periodLabel } from "./utils";

export interface UnpaidMonthBreakdown {
  period: string;
  label: string;
  amount: number;
  paid: number;
  balance: number;
}

export interface ChallanModel {
  kind: "challan";
  slipNo: string;
  tuitionName: string;
  tutorName: string;
  phone: string;
  address: string;
  footerNote: string;
  currency: string;
  studentName: string;
  gradeLine: string;
  joinLabel: string;
  periodLabel: string;
  issueDate: string;
  dueDate: string;
  monthlyFee: number;
  previousBalance: number;
  unpaidBreakdown: UnpaidMonthBreakdown[];
  lateFee: number;
  adjustment: number;
  totalCharge: number;
  paid: number;
  remaining: number;
  status: "Paid" | "Partial" | "Due" | "Overdue" | "Waived";
  waived: boolean;
}

export interface ReceiptModel {
  kind: "receipt";
  receiptNo: string;
  tuitionName: string;
  tutorName: string;
  phone: string;
  address: string;
  currency: string;
  studentName: string;
  gradeLine: string;
  date: string;
  periodLabel: string;
  method: string;
  reference?: string;
  amount: number;
  remainingAfter: number;
  statusAfter: string;
}

const statusWord = (s: string): ChallanModel["status"] =>
  s === "paid" ? "Paid" : s === "partial" ? "Partial" : s === "overdue" ? "Overdue" : s === "waived" ? "Waived" : "Due";

export function buildChallanModel(state: DataState, record: FeeRecord): ChallanModel {
  const s = state.settings;
  const student = state.students.find((x) => x.id === record.studentId);
  const prev = previousBalance(state, record.studentId, record.period);
  const paid = paidOf(state.payments, record.id);
  const bal = balanceOf(record, state.payments);
  const st = statusOf(record, state.payments, s.feePolicy.graceDays);
  const totalPayable = chargeOf(record) + prev;
  const netRemaining = bal + prev;

  const unpaidBreakdown: UnpaidMonthBreakdown[] = state.feeRecords
    .filter((r) => r.studentId === record.studentId && r.period < record.period && !r.waived)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((r) => ({
      period: r.period,
      label: periodLabel(r.period, true),
      amount: chargeOf(r),
      paid: paidOf(state.payments, r.id),
      balance: balanceOf(r, state.payments),
    }))
    .filter((x) => x.balance > 0);

  return {
    kind: "challan",
    slipNo: challanNo(state.feeRecords, record.id),
    tuitionName: s.tuitionName, tutorName: s.tutorName, phone: s.phone, address: s.address,
    footerNote: s.footerNote, currency: s.feePolicy.currency,
    studentName: student?.name ?? "Student",
    gradeLine: student ? `${student.grade}${student.level && student.level !== student.grade ? ` · ${student.level}` : ""}` : "",
    joinLabel: student?.joiningDate ? fmtDate(student.joiningDate, "dmy") : "—",
    periodLabel: periodLabel(record.period),
    issueDate: fmtDate(new Date().toISOString().slice(0, 10), "dmy"),
    dueDate: fmtDate(record.dueDate, "dmy"),
    monthlyFee: record.baseFee,
    previousBalance: prev,
    unpaidBreakdown,
    lateFee: record.lateFee,
    adjustment: record.adjustment,
    totalCharge: totalPayable,
    paid,
    remaining: netRemaining,
    status: record.waived ? "Waived" : statusWord(st),
    waived: record.waived,
  };
}

export function buildReceiptModel(state: DataState, payment: Payment): ReceiptModel {
  const s = state.settings;
  const student = state.students.find((x) => x.id === payment.studentId);
  const isMulti = payment.feeRecordIds && payment.feeRecordIds.length > 1;
  const records = isMulti
    ? state.feeRecords.filter((r) => payment.feeRecordIds!.includes(r.id)).sort((a, b) => a.period.localeCompare(b.period))
    : state.feeRecords.filter((r) => r.id === payment.feeRecordId);

  const remaining = records.reduce((sum, r) => sum + balanceOf(r, state.payments), 0);
  const periodText = isMulti
    ? `${records.map((r) => periodLabel(r.period, true)).join(", ")} (${records.length} Months)`
    : records[0] ? periodLabel(records[0].period) : "—";

  return {
    kind: "receipt",
    receiptNo: payment.receiptNo,
    tuitionName: s.tuitionName,
    tutorName: s.tutorName,
    phone: s.phone,
    address: s.address,
    currency: s.feePolicy.currency,
    studentName: student?.name ?? "Student",
    gradeLine: isMulti ? `${student?.grade ?? ""} · ${records.length} Months Cleared` : (student?.grade ?? ""),
    date: fmtDate(payment.date, "dmy"),
    periodLabel: periodText,
    method: payment.method,
    reference: payment.reference || undefined,
    amount: payment.amount,
    remainingAfter: remaining,
    statusAfter: remaining <= 0 ? "Fee fully paid — Thank you!" : `Remaining balance: ${fmtMoney(remaining, s.feePolicy.currency)}`,
  };
}

/* ================= canvas rendering ================= */

const NAVY = "#0e1830";
const NAVY2 = "#182647";
const GOLD = "#e8a020";
const GOLD_D = "#c77e0c";
const INK = "#1c2b45";
const MUT = "#5c6c86";
const LINE = "#e3e7ee";
const PAPER = "#fbfaf6";
const GREEN = "#12855f";
const RED = "#c03434";

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const DISPLAY = '"Bricolage Grotesque","IBM Plex Sans",sans-serif';
const BODY = '"IBM Plex Sans",sans-serif';
const MONO = '"IBM Plex Mono",monospace';

/** Draw the Tuition Desk graduation cap logo tile.
 *  tx/ty = top-left corner, size = tile width & height (square). */
function drawLogoTile(ctx: CanvasRenderingContext2D, tx: number, ty: number, size: number) {
  const sc = size / 32; // scale factor from 32×32 SVG viewBox

  // 1. Navy squircle background
  const borderW = Math.max(2, size * 0.055);
  rr(ctx, tx, ty, size, size, size * 0.24);
  ctx.fillStyle = "#0A1124"; ctx.fill();
  ctx.strokeStyle = "#E8A020"; ctx.lineWidth = borderW; ctx.stroke();

  // helper: scale a point from 32×32 space to canvas
  const px = (x: number) => tx + x * sc;
  const py = (y: number) => ty + y * sc;

  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";

  // 2. Mortarboard cap diamond: M16 7 L6 11.8 L16 16.6 L26 11.8 Z
  ctx.beginPath();
  ctx.moveTo(px(16), py(7));
  ctx.lineTo(px(6),  py(11.8));
  ctx.lineTo(px(16), py(16.6));
  ctx.lineTo(px(26), py(11.8));
  ctx.closePath();
  ctx.fillStyle = "#FBBF24"; ctx.fill();
  ctx.strokeStyle = "#E8A020"; ctx.lineWidth = sc * 0.8; ctx.stroke();

  // 3. Gown / neck arc: cubic bezier L→R open path
  ctx.beginPath();
  ctx.moveTo(px(21.5), py(14.5));
  ctx.lineTo(px(21.5), py(19.2));
  // bezier to centre-bottom
  ctx.bezierCurveTo(px(21.5), py(20.8), px(19.2), py(22), px(16), py(22));
  ctx.bezierCurveTo(px(12.8), py(22), px(10.5), py(20.8), px(10.5), py(19.2));
  ctx.lineTo(px(10.5), py(14.5));
  ctx.strokeStyle = "#FBBF24"; ctx.lineWidth = sc * 1.5; ctx.stroke();

  // 4. Tassel line: M26 12.2 V17
  ctx.beginPath();
  ctx.moveTo(px(26), py(12.2));
  ctx.lineTo(px(26), py(17));
  ctx.strokeStyle = "#FBBF24"; ctx.lineWidth = sc * 1.2; ctx.stroke();

  // 5. Tassel dot: circle at (26,18) r=1
  ctx.beginPath();
  ctx.arc(px(26), py(18), sc * 1.1, 0, Math.PI * 2);
  ctx.fillStyle = "#FBBF24"; ctx.fill();

  // 6. Base line: M12 24.8 H20
  ctx.beginPath();
  ctx.moveTo(px(12), py(24.8));
  ctx.lineTo(px(20), py(24.8));
  ctx.strokeStyle = "#FBBF24"; ctx.lineWidth = sc * 1.4; ctx.stroke();

  ctx.restore();
}



function drawChallan(m: ChallanModel): string {
  const W = 880, H = 1136;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);

  /* header band */
  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, 190);
  ctx.fillStyle = NAVY2; ctx.fillRect(0, 150, W, 40);
  // subtle grid
  ctx.strokeStyle = "rgba(232,160,32,0.07)"; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 44) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 150); ctx.stroke(); }
  // logo tile — new graduation cap icon
  drawLogoTile(ctx, 48, 38, 86);
  // titles
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff"; ctx.font = `800 34px ${DISPLAY}`;
  ctx.fillText(m.tuitionName, 152, 78, 430);
  ctx.fillStyle = GOLD; ctx.font = `700 13px ${BODY}`;
  ctx.fillText("T U I T I O N   F E E   C H A L L A N", 153, 102);
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = `400 14px ${BODY}`;
  ctx.fillText(m.address, 152, 126, 440);
  ctx.fillText(m.phone, 152, 144);
  // right block
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = `700 12px ${BODY}`;
  ctx.fillText("CHALLAN No.", W - 56, 60);
  ctx.fillStyle = "#ffffff"; ctx.font = `700 26px ${MONO}`;
  ctx.fillText(m.slipNo, W - 56, 90);
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = `400 13px ${BODY}`;
  ctx.fillText(`Issued ${m.issueDate}`, W - 56, 114);
  ctx.textAlign = "left";
  // gold rule
  ctx.fillStyle = GOLD; ctx.fillRect(0, 190, W, 6);

  /* student / period meta */
  let y = 244;
  const colL = 56, colR = W / 2 + 28;
  ctx.fillStyle = MUT; ctx.font = `700 12px ${BODY}`;
  ctx.fillText("STUDENT", colL, y); ctx.fillText("BILLING", colR, y);
  y += 30;
  ctx.fillStyle = INK; ctx.font = `700 26px ${DISPLAY}`;
  ctx.fillText(m.studentName, colL, y, 360);
  ctx.font = `700 26px ${DISPLAY}`; ctx.fillText(m.periodLabel, colR, y);
  y += 26;
  ctx.fillStyle = MUT; ctx.font = `400 15px ${BODY}`;
  ctx.fillText(m.gradeLine || "—", colL, y);
  ctx.fillText(`Fee month / period`, colR, y);
  y += 24;
  ctx.fillText(`Admitted: ${m.joinLabel}`, colL, y);
  ctx.fillStyle = RED; ctx.font = `700 15px ${BODY}`;
  ctx.fillText(`Due date: ${m.dueDate}`, colR, y);
  y += 18;
  ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(56, y); ctx.lineTo(W - 56, y); ctx.stroke();

  /* amounts table */
  y += 46;

  // Helper to draw one table row
  const drawRow = (label: string, val: string, bold = false) => {
    ctx.fillStyle = INK; ctx.font = bold ? `700 17px ${BODY}` : `400 17px ${BODY}`;
    ctx.fillText(label, 72, y);
    ctx.textAlign = "right"; ctx.font = bold ? `700 17px ${MONO}` : `600 17px ${MONO}`; ctx.fillStyle = INK;
    ctx.fillText(val, W - 72, y); ctx.textAlign = "left";
    y += 16;
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(72, y); ctx.lineTo(W - 72, y); ctx.stroke();
    y += 30;
  };

  // Row 1: Monthly fee
  drawRow("Monthly fee (" + m.periodLabel + ")", fmtMoney(m.monthlyFee, m.currency));

  // Row 2: Previous balance — if arrears exist, show compact inline box below
  if (m.previousBalance > 0 && m.unpaidBreakdown && m.unpaidBreakdown.length > 0) {
    const prevRowLabel = `Arrears (${m.unpaidBreakdown.length} unpaid month${m.unpaidBreakdown.length > 1 ? "s" : ""})`;
    ctx.fillStyle = INK; ctx.font = `400 17px ${BODY}`;
    ctx.fillText(prevRowLabel, 72, y);
    ctx.textAlign = "right"; ctx.font = `600 17px ${MONO}`; ctx.fillStyle = RED;
    ctx.fillText(fmtMoney(m.previousBalance, m.currency), W - 72, y); ctx.textAlign = "left";
    y += 20;

    // Compact arrears mini-table — two columns side by side
    const colW = (W - 144) / 2;
    ctx.font = `500 12px ${BODY}`; ctx.fillStyle = RED;
    m.unpaidBreakdown.forEach((x, i) => {
      const colX = 72 + (i % 2) * (colW + 12);
      if (i % 2 === 0 && i > 0) y += 20; // new row every 2 items
      ctx.fillText(`• ${x.label}`, colX, y);
      ctx.textAlign = "right"; ctx.font = `600 12px ${MONO}`;
      ctx.fillText(fmtMoney(x.balance, m.currency), colX + colW, y); ctx.textAlign = "left";
      ctx.font = `500 12px ${BODY}`;
      if (i % 2 === 1 || i === m.unpaidBreakdown.length - 1) {
        // no-op, newline handled above
      }
    });
    // Ensure we advance past last row if odd count
    y += 20;

    y += 6;
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(72, y); ctx.lineTo(W - 72, y); ctx.stroke();
    y += 26;
  } else if (m.previousBalance > 0) {
    drawRow("Previous balance", fmtMoney(m.previousBalance, m.currency));
  }

  // Late fee
  if (m.lateFee > 0) drawRow("Late fee", fmtMoney(m.lateFee, m.currency));
  // Adjustment
  if (m.adjustment !== 0) drawRow("Adjustment", (m.adjustment > 0 ? "+" : "−") + fmtMoney(Math.abs(m.adjustment), m.currency).replace(m.currency, m.currency + " "));

  // total charge
  rr(ctx, 56, y - 6, W - 112, 52, 10);
  ctx.fillStyle = "#f1eee4"; ctx.fill();
  ctx.fillStyle = INK; ctx.font = `700 18px ${BODY}`;
  ctx.fillText("Total charge", 76, y + 26);
  ctx.textAlign = "right"; ctx.font = `700 19px ${MONO}`;
  ctx.fillText(fmtMoney(m.totalCharge, m.currency), W - 76, y + 26); ctx.textAlign = "left";
  y += 76;
  // paid
  ctx.fillStyle = GREEN; ctx.font = `700 17px ${BODY}`;
  ctx.fillText("Paid amount", 76, y);
  ctx.textAlign = "right"; ctx.font = `700 17px ${MONO}`;
  ctx.fillText("− " + fmtMoney(m.paid, m.currency), W - 76, y); ctx.textAlign = "left";
  y += 34;

  /* remaining — big */
  rr(ctx, 56, y - 8, W - 112, 96, 12);
  ctx.fillStyle = NAVY; ctx.fill();
  ctx.fillStyle = GOLD; ctx.fillRect(56, y - 8, 8, 96);
  ctx.fillStyle = "rgba(255,255,255,0.72)"; ctx.font = `700 13px ${BODY}`;
  ctx.fillText(m.waived ? "FEE WAIVED" : "REMAINING DUE", 88, y + 26);
  ctx.fillStyle = "#ffffff"; ctx.font = `800 40px ${DISPLAY}`;
  ctx.fillText(m.waived ? "Rs 0" : fmtMoney(m.remaining, m.currency), 88, y + 68);
  // stamp
  ctx.save();
  ctx.translate(W - 208, y + 40); ctx.rotate(-0.14);
  const stampCol = m.status === "Paid" ? GREEN : m.status === "Overdue" ? RED : m.status === "Waived" ? MUT : GOLD_D;
  ctx.strokeStyle = stampCol; ctx.lineWidth = 4;
  rr(ctx, -86, -30, 172, 60, 8); ctx.stroke();
  ctx.fillStyle = stampCol; ctx.font = `800 30px ${DISPLAY}`; ctx.textAlign = "center";
  ctx.fillText(m.status.toUpperCase(), 0, 11);
  ctx.restore();
  ctx.textAlign = "left";
  y += 130;

  /* footer */
  ctx.fillStyle = NAVY; ctx.fillRect(0, H - 132, W, 132);
  ctx.fillStyle = GOLD; ctx.fillRect(0, H - 132, W, 4);
  ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = `400 14px ${BODY}`;
  const note = wrap(ctx, m.footerNote || "Thank you for your support.", W - 130);
  note.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, 56, H - 96 + i * 20));
  ctx.fillStyle = GOLD; ctx.font = `700 14px ${BODY}`;
  ctx.fillText(`${m.tutorName} · ${m.tuitionName} · ${m.phone}`, 56, H - 40);
  ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = `400 12px ${MONO}`;
  ctx.fillText(m.slipNo, W - 56, H - 40);
  ctx.textAlign = "left";

  return cv.toDataURL("image/png");
}

function drawReceipt(m: ReceiptModel): string {
  const W = 760, H = 940;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#f4f3ee"; ctx.fillRect(0, 0, W, H);
  // card
  rr(ctx, 40, 36, W - 80, H - 118, 16);
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 1.5; ctx.stroke();

  /* header */
  ctx.save();
  rr(ctx, 40, 36, W - 80, 148, 16); ctx.clip();
  ctx.fillStyle = NAVY; ctx.fillRect(40, 36, W - 80, 148);
  ctx.strokeStyle = "rgba(232,160,32,0.09)"; ctx.lineWidth = 1;
  for (let x = 40; x < W - 40; x += 34) { ctx.beginPath(); ctx.moveTo(x, 36); ctx.lineTo(x, 184); ctx.stroke(); }
  // graduation cap logo
  drawLogoTile(ctx, 60, 54, 78);
  // text labels — shifted right to make room for logo
  ctx.fillStyle = GOLD; ctx.font = `700 12px ${BODY}`;
  ctx.fillText("O F F I C I A L   R E C E I P T", 158, 78);
  ctx.fillStyle = "#ffffff"; ctx.font = `800 26px ${DISPLAY}`;
  ctx.fillText(m.tuitionName, 158, 112, 360);
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = `400 13px ${BODY}`;
  ctx.fillText(m.address, 158, 136, 360);
  ctx.fillText(m.phone, 158, 156);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.font = `700 12px ${BODY}`;
  ctx.fillText("RECEIPT No.", W - 76, 76);
  ctx.fillStyle = GOLD; ctx.font = `700 24px ${MONO}`;
  ctx.fillText(m.receiptNo, W - 76, 106);
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = `400 13px ${BODY}`;
  ctx.fillText(m.date, W - 76, 130);
  ctx.restore();
  ctx.textAlign = "left";

  /* amount block */
  let y = 236;
  ctx.fillStyle = MUT; ctx.font = `700 13px ${BODY}`;
  ctx.fillText("AMOUNT RECEIVED", 76, y);
  y += 46;
  ctx.fillStyle = GREEN; ctx.font = `800 54px ${DISPLAY}`;
  ctx.fillText(fmtMoney(m.amount, m.currency), 76, y);
  y += 26;
  ctx.fillStyle = MUT; ctx.font = `600 15px ${BODY}`;
  ctx.fillText(`Received with thanks from the parent of`, 76, y);
  y += 28;
  ctx.fillStyle = INK; ctx.font = `700 24px ${DISPLAY}`;
  ctx.fillText(m.studentName, 76, y);
  ctx.fillStyle = MUT; ctx.font = `400 14px ${BODY}`;
  const gtxt = `${m.gradeLine} · Fee: ${m.periodLabel}`;
  ctx.fillText(gtxt, 76, y + 22, W - 152);
  y += 44;
  ctx.strokeStyle = LINE; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(76, y); ctx.lineTo(W - 76, y); ctx.stroke();
  ctx.setLineDash([]);
  y += 36;

  /* detail rows */
  const rows: [string, string][] = [
    ["Payment date", m.date],
    ["Fee period / months", m.periodLabel],
    ["Payment method", m.method],
  ];
  if (m.reference) rows.push(["Reference", m.reference]);
  rows.push(["Balance after payment", m.remainingAfter <= 0 ? "Rs 0 — fully paid" : fmtMoney(m.remainingAfter, m.currency)]);
  for (const [k, v] of rows) {
    ctx.fillStyle = MUT; ctx.font = `600 15px ${BODY}`;
    ctx.fillText(k, 76, y);
    ctx.textAlign = "right"; ctx.fillStyle = INK; ctx.font = `700 14px ${MONO}`;
    ctx.fillText(v, W - 76, y, 420); ctx.textAlign = "left";
    y += 38;
  }

  /* status pill */
  y += 6;
  const pill = m.remainingAfter <= 0 ? ["FEE FULLY PAID — THANK YOU!", GREEN] : ["BALANCE REMAINING — KINDLY PAY BY DUE DATE", GOLD_D];
  ctx.font = `700 13px ${BODY}`;
  const pw = ctx.measureText(pill[0]).width + 40;
  rr(ctx, 76, y - 20, pw, 34, 17);
  ctx.fillStyle = (pill[1] as string) + "1a"; ctx.fill();
  ctx.strokeStyle = pill[1] as string; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = pill[1] as string;
  ctx.fillText(pill[0], 96, y + 2);
  y += 62;

  /* signature + footer */
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W - 300, y); ctx.lineTo(W - 76, y); ctx.stroke();
  ctx.fillStyle = MUT; ctx.font = `600 12px ${BODY}`;
  ctx.textAlign = "right"; ctx.fillText(m.tutorName + " — Signature", W - 76, y + 20); ctx.textAlign = "left";

  // torn edge (zigzag)
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(40, H - 82);
  for (let x = 40; x <= W - 40; x += 20) ctx.lineTo(x + 10, H - 66), ctx.lineTo(x + 20, H - 82);
  ctx.lineTo(W - 40, H - 82);
  ctx.lineTo(W - 40, H - 82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = MUT; ctx.font = `400 12px ${BODY}`;
  ctx.textAlign = "center";
  ctx.fillText(`${m.tuitionName} · This is a computer-generated receipt · ${m.receiptNo}`, W / 2, H - 40);
  ctx.textAlign = "left";

  return cv.toDataURL("image/png");
}

export function renderSlip(m: ChallanModel | ReceiptModel): string {
  return m.kind === "challan" ? drawChallan(m) : drawReceipt(m);
}

export { studentPaidToDate };
