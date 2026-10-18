import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ClassLevel, Guardian, Student } from "../types";
import { useStore, withActivity } from "../lib/store";
import { ensureFeeRecords } from "../lib/fee";
import { RELATIONS, clampDay, currentPeriod, fmtMoney, isValidPhone, lastNPeriods, monthKeyOf, naturalCompare, num, periodLabel, periodsBetween, shiftPeriod, uid } from "../lib/utils";
import { Btn, Confirm, Field, Icon, Modal, Switch, TInput, TSelect, TArea, useToast } from "./ui";

interface DraftGuardian {
  id: string; name: string; relation: string; phone: string; whatsapp: boolean; primary: boolean; notes?: string;
}

const emptyGuardian = (): DraftGuardian => ({ id: uid("grd"), name: "", relation: "Father", phone: "", whatsapp: true, primary: false, notes: "" });

export const STANDARD_CLASSES = [
  "Pre-School (Not Going to School)",
  "Nursery",
  "KG 1",
  "KG 2",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "First Year (11th)",
  "Second Year (12th)",
];

export function deriveAcademicLevel(grade: string): ClassLevel {
  const g = grade.toLowerCase();
  if (g.includes("pre") || g.includes("not school") || g.includes("home")) return "Pre-school";
  if (g.includes("nursery")) return "Nursery";
  if (g.includes("kg") || g.includes("prep")) return "Prep";
  if (g.includes("class 1") || g.includes("class 2") || g.includes("class 3") || g.includes("class 4") || g.includes("class 5") || g.includes("primary")) return "Primary";
  if (g.includes("class 6") || g.includes("class 7") || g.includes("class 8") || g.includes("middle")) return "Middle";
  if (g.includes("class 9") || g.includes("class 10") || g.includes("matric")) return "Matric";
  if (g.includes("first year") || g.includes("11") || g.includes("second year") || g.includes("12") || g.includes("inter") || g.includes("college")) return "Intermediate";
  return "Primary";
}

export default function StudentForm({ open, onClose, editId, presetClass }: { open: boolean; onClose: () => void; editId?: string; presetClass?: string }) {
  const { state, patch } = useStore();
  const toast = useToast();
  const editing = state.students.find((s) => s.id === editId);

  const gradeOptions = useMemo(() => {
    return STANDARD_CLASSES;
  }, []);

  const [name, setName] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [customGrade, setCustomGrade] = useState("");
  const [school, setSchool] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [feeStartPeriod, setFeeStartPeriod] = useState(currentPeriod());
  const [allSubjects, setAllSubjects] = useState(true);
  const [subjectsText, setSubjectsText] = useState("");
  const [dueMode, setDueMode] = useState<"1" | "custom">("1");
  const [dueDayStr, setDueDayStr] = useState("5");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [guardians, setGuardians] = useState<DraftGuardian[]>([emptyGuardian()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmSave, setConfirmSave] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const effectiveGrade = selectedGrade === "other" ? customGrade : selectedGrade;

  const pendingPeriods = useMemo(() => {
    return periodsBetween(feeStartPeriod, currentPeriod());
  }, [feeStartPeriod]);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setConfirmSave(false);
    if (editing) {
      setName(editing.name);
      if (STANDARD_CLASSES.includes(editing.grade)) {
        setSelectedGrade(editing.grade);
        setCustomGrade("");
      } else {
        setSelectedGrade(editing.grade || "other");
        setCustomGrade(editing.grade || "");
      }
      setSchool(editing.school ?? "");
      setJoiningDate(editing.joiningDate ?? "");
      setFeeStartPeriod(editing.joiningDate ? monthKeyOf(editing.joiningDate) : currentPeriod());
      const subs = editing.subjects ?? [];
      setAllSubjects(subs.length === 0);
      setSubjectsText(subs.join(", "));
      setDueMode(editing.feeDueDay === 1 ? "1" : "custom");
      setDueDayStr(String(editing.feeDueDay === 1 ? 5 : editing.feeDueDay));
      setMonthlyFee(String(editing.monthlyFee));
      setStatus(editing.status);
      setAddress(editing.address ?? "");
      setNotes(editing.notes ?? "");
      setPhoto(editing.photo ?? null);
      const gs = state.guardians.filter((g) => g.studentId === editing.id);
      setGuardians(gs.length ? gs.map((g) => ({ ...g })) : [emptyGuardian()]);
    } else {
      setName("");
      const initialGrade = presetClass || STANDARD_CLASSES[0];
      setSelectedGrade(initialGrade);
      setCustomGrade("");
      setSchool("");
      setJoiningDate("");
      setFeeStartPeriod(currentPeriod());
      setAllSubjects(true);
      setSubjectsText("");
      setDueMode("1");
      setDueDayStr("5");
      setMonthlyFee(String(state.settings.feePolicy.defaultFee));
      setStatus("active");
      setAddress("");
      setNotes("");
      setPhoto(null);
      setGuardians([emptyGuardian()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId, presetClass]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Student name is required.";
    if (!effectiveGrade.trim()) e.grade = "Please select or enter a class.";
    const fee = num(monthlyFee);
    if (fee <= 0) e.monthlyFee = "Monthly fee must be greater than 0.";
    const d = parseInt(dueDayStr, 10);
    if (dueMode === "custom" && (isNaN(d) || d < 2 || d > 28)) {
      e.dueDay = "Pick a date between 2 and 28.";
    }
    const gsWithPhone = guardians.filter((g) => g.phone.trim());
    for (const g of gsWithPhone) if (!isValidPhone(g.phone)) { e[`g-${g.id}`] = "This phone number does not look valid."; }
    const phones = gsWithPhone.map((g) => g.phone.replace(/\D/g, ""));
    if (new Set(phones).size !== phones.length) e.guardians = "Two guardians have the same phone number.";
    for (const g of guardians) if (g.phone.trim() && !g.name.trim()) { e[`g-${g.id}`] = "Give this contact a name."; }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const doSave = () => {
    const subjects = allSubjects ? [] : subjectsText.split(",").map((x) => x.trim()).filter(Boolean);
    const finalGrade = effectiveGrade.trim();
    const finalLevel = deriveAcademicLevel(finalGrade);
    const finalDueDay = dueMode === "1" ? 1 : Math.min(28, Math.max(2, parseInt(dueDayStr, 10) || 5));
    const finalJoinDate = joiningDate || clampDay(feeStartPeriod, 1);

    const student: Student = {
      id: editing ? editing.id : uid("stu"),
      name: name.trim(),
      level: finalLevel,
      grade: finalGrade,
      school: school.trim() || undefined,
      subjects: subjects.length ? subjects : undefined,
      feeDueDay: finalDueDay,
      monthlyFee: Math.round(num(monthlyFee)),
      joiningDate: finalJoinDate,
      status,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      photo,
    };
    const newGuardians: Guardian[] = guardians
      .filter((g) => g.phone.trim())
      .map((g, i, arr) => ({
        id: g.id, studentId: student.id, name: g.name.trim() || g.relation, relation: g.relation,
        phone: g.phone.trim(), whatsapp: g.whatsapp,
        primary: arr.some((x) => x.primary) ? g.primary : i === 0,
        notes: g.notes?.trim() || undefined,
      }));
    const otherGuardians = state.guardians.filter((g) => g.studentId !== student.id);
    const students = editing
      ? state.students.map((s) => (s.id === student.id ? student : s))
      : [...state.students, student];
    const updatedState = { ...state, students, guardians: [...otherGuardians, ...newGuardians] };
    const refreshedFees = ensureFeeRecords(updatedState);
    const next = { ...updatedState, feeRecords: refreshedFees.records };
    patch({
      students,
      guardians: next.guardians,
      feeRecords: next.feeRecords,
      activity: withActivity(next, editing ? `Student "${student.name}" updated (${student.grade}, ${fmtMoney(student.monthlyFee, state.settings.feePolicy.currency)}/month).` : `New student admitted — ${student.name} (${student.grade}, ${fmtMoney(student.monthlyFee, state.settings.feePolicy.currency)}/month).`, "student"),
    });
    toast.push(editing ? "Student updated" : `${student.name} added to ${student.grade}`);
    onClose();
  };

  const trySave = () => {
    if (!validate()) { toast.push("Please fix the highlighted fields", "err"); return; }
    if (editing) setConfirmSave(true);
    else doSave();
  };

  const upG = (id: string, p: Partial<DraftGuardian>) => setGuardians((gs) => gs.map((g) => (g.id === id ? { ...g, ...p } : g)));

  const onPhoto = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 400_000) { toast.push("Photo is large — pick one under 400 KB to keep storage light", "warn"); return; }
    const r = new FileReader();
    r.onload = () => setPhoto(String(r.result));
    r.readAsDataURL(f);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} wide title={editing ? "Edit Student" : "Add Student"}
        sub={editing ? editing.id : "Admission form — class, fee billing start and parent contacts"}
        footer={<>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="gold" icon="save" onClick={trySave}>{editing ? "Save Changes" : "Admit Student"}</Btn>
        </>}>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Full Name" required error={errors.name}>
            <TInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ayaan Malik" />
          </Field>

          <Field label="Class" required error={errors.grade} hint="Select standard class or choose custom.">
            <TSelect value={selectedGrade} onChange={(e) => {
              const val = e.target.value;
              setSelectedGrade(val);
              if (val !== "other") setCustomGrade("");
            }}>
              <option value="" disabled>Select Class…</option>
              {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
              <option value="other">Other / Custom Class…</option>
            </TSelect>
            {selectedGrade === "other" && (
              <TInput className="mt-2" autoFocus value={customGrade} onChange={(e) => setCustomGrade(e.target.value)} placeholder="Type custom class name…" />
            )}
          </Field>

          <Field label="School / College">
            <TInput value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Joining Date" hint="Optional — date student joined tuition.">
            <TInput type="date" value={joiningDate} onChange={(e) => {
              const val = e.target.value;
              setJoiningDate(val);
              if (val) setFeeStartPeriod(monthKeyOf(val));
            }} />
          </Field>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between rounded-[10px] border border-ink-200 bg-ink-50/60 px-3.5 py-2.5">
              <div>
                <span className="block text-[12.5px] font-bold text-ink-900">All subjects of the class</span>
                <span className="block text-[11.5px] text-ink-400">Turn off only if the student comes for specific subjects.</span>
              </div>
              <Switch checked={allSubjects} onChange={setAllSubjects} label="All subjects" />
            </div>
            {!allSubjects && (
              <TInput className="mt-2" value={subjectsText} onChange={(e) => setSubjectsText(e.target.value)} placeholder="e.g. Math, Science (comma separated)" />
            )}
          </div>

          <Field label="Monthly Fee (Rs)" required error={errors.monthlyFee}>
            <TInput type="number" min={0} value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} />
          </Field>

          <Field label="Fee Billing Starts From" hint="From which month challans & fee records should begin.">
            <TSelect value={feeStartPeriod} onChange={(e) => {
              const p = e.target.value;
              setFeeStartPeriod(p);
              if (!joiningDate || joiningDate.slice(0, 7) !== p) {
                setJoiningDate(clampDay(p, 1));
              }
            }}>
              <option value={currentPeriod()}>{periodLabel(currentPeriod())} (Current Month / New Admission)</option>
              <option value={shiftPeriod(currentPeriod(), -1)}>{periodLabel(shiftPeriod(currentPeriod(), -1))} (1 Month Past Due)</option>
              <option value={shiftPeriod(currentPeriod(), -2)}>{periodLabel(shiftPeriod(currentPeriod(), -2))} (2 Months Past Due)</option>
              <option value={shiftPeriod(currentPeriod(), -3)}>{periodLabel(shiftPeriod(currentPeriod(), -3))} (3 Months Past Due)</option>
              <option value={shiftPeriod(currentPeriod(), -4)}>{periodLabel(shiftPeriod(currentPeriod(), -4))} (4 Months Past Due)</option>
              <option value={shiftPeriod(currentPeriod(), -5)}>{periodLabel(shiftPeriod(currentPeriod(), -5))} (5 Months Past Due)</option>
              <option value={shiftPeriod(currentPeriod(), -6)}>{periodLabel(shiftPeriod(currentPeriod(), -6))} (6 Months Past Due)</option>
              <optgroup label="Other Earlier Months">
                {lastNPeriods(12).filter((p) => p < shiftPeriod(currentPeriod(), -6)).map((p) => (
                  <option key={p} value={p}>{periodLabel(p)}</option>
                ))}
              </optgroup>
            </TSelect>
          </Field>

          {pendingPeriods.length > 1 && (
            <div className="sm:col-span-2 rounded-[10px] border border-gold-400/50 bg-gold-50/80 p-3 flex items-start gap-2.5 anim-fade-in">
              <span className="text-[18px]">📋</span>
              <div className="text-[12px] text-ink-800">
                <p className="font-bold text-ink-950">
                  {pendingPeriods.length} Months Fee Records will be generated ({pendingPeriods.map((p) => periodLabel(p, true)).join(", ")})
                </p>
                <p className="mt-0.5 text-ink-600">
                  Total initial dues: <b className="font-mono text-gold-800">{fmtMoney(pendingPeriods.length * num(monthlyFee), state.settings.feePolicy.currency)}</b>. These can be collected individually or all at once using "Record Payment".
                </p>
              </div>
            </div>
          )}

          <Field label="Fee Due Day" error={errors.dueDay} hint="The day of each month this fee becomes due.">
            <div className="flex items-center gap-3">
              <label className={`flex-1 flex items-center gap-2 rounded-[9px] border px-3 h-9.5 cursor-pointer ${dueMode === "1" ? "border-gold-500 bg-gold-50" : "border-ink-200"}`}>
                <input type="radio" checked={dueMode === "1"} onChange={() => setDueMode("1")} className="accent-[#c77e0c]" />
                <span className="text-[12.5px] font-semibold">1st of every month</span>
              </label>
              <label className={`flex items-center gap-2 rounded-[9px] border px-3 h-9.5 cursor-pointer ${dueMode === "custom" ? "border-gold-500 bg-gold-50" : "border-ink-200"}`}>
                <input type="radio" checked={dueMode === "custom"} onChange={() => setDueMode("custom")} className="accent-[#c77e0c]" />
                <span className="text-[12.5px] font-semibold">Date</span>
                <input type="text" inputMode="numeric" disabled={dueMode !== "custom"} value={dueDayStr}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setDueDayStr(cleaned);
                  }}
                  onBlur={() => {
                    const d = parseInt(dueDayStr, 10);
                    if (isNaN(d) || d < 2 || d > 28) {
                      setDueDayStr("5");
                    } else {
                      setDueDayStr(String(d));
                    }
                  }}
                  className="w-14 h-7 px-1.5 rounded-md border border-ink-200 text-center font-mono font-bold text-[12.5px] disabled:opacity-40" />
              </label>
            </div>
          </Field>

          {editing && (
            <Field label="Status">
              <TSelect value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </TSelect>
            </Field>
          )}

          <Field label="Address" className="sm:col-span-2">
            <TInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <TArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering…" />
          </Field>
        </div>

        {/* guardians */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="font-display font-bold text-[15px] text-ink-900">Parent / Guardian Contacts</h3>
            <Btn size="sm" variant="outline" icon="plus" onClick={() => setGuardians((gs) => [...gs, emptyGuardian()])}>Add Number</Btn>
          </div>
          {errors.guardians && <p className="text-[12px] font-semibold text-flame-600 mb-2">{errors.guardians}</p>}
          <div className="space-y-3">
            {guardians.map((g, gi) => (
              <div key={g.id} className="rounded-[11px] border border-ink-150 bg-ink-50/40 p-3.5 anim-fade-in">
                <div className="grid sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-2.5 items-start">
                  <div>
                    <TInput placeholder="Name" value={g.name} onChange={(e) => upG(g.id, { name: e.target.value })} />
                  </div>
                  <TSelect value={g.relation} onChange={(e) => upG(g.id, { relation: e.target.value })}>
                    {RELATIONS.map((r) => <option key={r}>{r}</option>)}
                  </TSelect>
                  <TInput placeholder="03xx-xxxxxxx" inputMode="tel" value={g.phone} onChange={(e) => upG(g.id, { phone: e.target.value })} />
                  <button onClick={() => setGuardians((gs) => (gs.length > 1 ? gs.filter((x) => x.id !== g.id) : gs))}
                    className="h-9.5 w-9 rounded-[8px] border border-ink-200 bg-white text-ink-400 hover:text-flame-600 hover:border-flame-500 flex items-center justify-center" aria-label="Remove contact">
                    <Icon name="trash" size={15} />
                  </button>
                </div>
                {errors[`g-${g.id}`] && <p className="text-[11.5px] font-semibold text-flame-600 mt-1.5">{errors[`g-${g.id}`]}</p>}
                <div className="flex items-center gap-5 mt-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={g.whatsapp} onChange={(v) => upG(g.id, { whatsapp: v })} label="WhatsApp available" />
                    <span className="text-[12px] font-semibold text-ink-600">WhatsApp</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={g.primary} onChange={(v) => upG(g.id, { primary: v })} label="Primary contact" />
                    <span className="text-[12px] font-semibold text-ink-600">Primary</span>
                  </label>
                  {gi === 0 && guardians.length === 1 && <span className="text-[11px] text-ink-400">Add more numbers if the family shares phones.</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* photo */}
        <div className="mt-6 flex items-center gap-4">
          {photo ? (
            <img src={photo} alt="Student" className="w-14 h-14 rounded-[12px] object-cover border border-ink-150" />
          ) : (
            <span className="w-14 h-14 rounded-[12px] bg-ink-50 border border-dashed border-ink-200 flex items-center justify-center text-ink-300"><Icon name="image" size={20} /></span>
          )}
          <div>
            <Btn size="sm" variant="outline" icon="upload" onClick={() => photoRef.current?.click()}>{photo ? "Change Photo" : "Add Photo (optional)"}</Btn>
            {photo && <button onClick={() => setPhoto(null)} className="ml-3 text-[12px] font-bold text-flame-600 hover:underline">Remove</button>}
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
            <p className="text-[11px] text-ink-400 mt-1">Small photos keep the local storage fast.</p>
          </div>
        </div>
      </Modal>

      <Confirm open={confirmSave} onClose={() => setConfirmSave(false)} onConfirm={doSave} tone="gold" title="Save these changes?"
        confirmLabel="Yes, Save Changes"
        message={<>You are updating <b>{editing?.name}</b>'s record. Past fee and attendance history will stay untouched — the new fee applies from the next month's challan.</>} />
    </>
  );
}
