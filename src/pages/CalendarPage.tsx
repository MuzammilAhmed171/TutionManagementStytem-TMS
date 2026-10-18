import React, { useMemo, useState } from "react";
import { Badge, Btn, Confirm, Icon, Modal, PageHead, TInput, TSelect, useToast } from "../components/ui";
import { useStore, withActivity } from "../lib/store";
import { WEEKDAYS, WEEKDAYS_S, fmtDate, monthKeyOf, naturalCompare, openWhatsApp, pad2, periodLabel, shareNativeOrWhatsApp, shiftPeriod, timeLabel, todayISO, uid, weekdayIdx } from "../lib/utils";
import type { Holiday, HolidayScope } from "../types";

export default function CalendarPage() {
  const { state, patch } = useStore();
  const toast = useToast();
  const df = state.settings.dateFormat;
  const today = todayISO();
  const [month, setMonth] = useState(monthKeyOf(today));
  const [selected, setSelected] = useState(today);

  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<HolidayScope>("all");
  const [className, setClassName] = useState("");
  const [err, setErr] = useState("");
  const [delAsk, setDelAsk] = useState<string | null>(null);

  /* holiday notice sharing */
  const [shareHol, setShareHol] = useState<Holiday | null>(null);
  const [selGuards, setSelGuards] = useState<string[]>([]);
  const [holMsg, setHolMsg] = useState("");

  const classes = useMemo(() => Array.from(new Set(state.students.map((s) => s.grade))).sort(naturalCompare), [state.students]);

  const shareHoliday = (h: Holiday) => {
    const targetStudents = h.scope === "class"
      ? state.students.filter((s) => s.grade === h.className && s.status === "active")
      : state.students.filter((s) => s.status === "active");
    const eligibleGuards = state.guardians.filter((g) => targetStudents.some((s) => s.id === g.studentId) && g.whatsapp && g.phone.trim());
    setShareHol(h);
    setSelGuards(eligibleGuards.map((g) => g.id));
    setHolMsg(
      `Assalam-o-Alaikum! Tamam parents ko ittila di jati hai ke ${fmtDate(h.date, df)} (${h.title}) ko ${state.settings.tuitionName} mein chutti hogi.${h.reason ? ` Wajah: ${h.reason}.` : ""} Regular classes will resume on the next working day. JazakAllah! — ${state.settings.tutorName}`
    );
  };

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const dim = new Date(y, m, 0).getDate();
    const out: { date: string; day: number }[] = [];
    for (let i = 0; i < first.getDay(); i++) out.push({ date: "", day: 0 });
    for (let d = 1; d <= dim; d++) out.push({ date: `${month}-${pad2(d)}`, day: d });
    return out;
  }, [month]);

  const holidaysOn = (date: string) => state.holidays.filter((h) => h.date === date);

  const addHoliday = () => {
    if (!title.trim()) { setErr("Give the holiday a name — e.g. Eid, Personal work."); return; }
    if (scope === "class" && !className) { setErr("Pick which class this holiday applies to."); return; }
    setErr("");
    const h = { id: uid("hol"), date: selected, scope, className: scope === "class" ? className : undefined, title: title.trim(), reason: reason.trim() || undefined };
    const holidays = [...state.holidays, h];
    patch({ holidays, activity: withActivity({ ...state, holidays }, `Holiday added — ${h.title} on ${fmtDate(selected, df)}${scope === "class" ? ` (${className} only)` : " (whole tuition)"}.`, "settings") });
    setTitle(""); setReason("");
    toast.push("Holiday added — attendance is protected on this day");
  };

  const removeHoliday = (id: string) => {
    const h = state.holidays.find((x) => x.id === id);
    const holidays = state.holidays.filter((x) => x.id !== id);
    patch({ holidays, activity: withActivity({ ...state, holidays }, `Holiday removed — ${h?.title} (${fmtDate(h?.date ?? "", df)}).`, "settings") });
    toast.push("Holiday removed");
  };

  const toggleOff = (d: number) => {
    const weeklyOffs = state.settings.weeklyOffs.includes(d)
      ? state.settings.weeklyOffs.filter((x) => x !== d)
      : [...state.settings.weeklyOffs, d].sort();
    const settings = { ...state.settings, weeklyOffs };
    patch({ settings, activity: withActivity({ ...state, settings }, `Weekly off updated: ${weeklyOffs.map((x) => WEEKDAYS[x]).join(", ") || "none"}.`, "settings") });
    toast.push("Weekly off days updated");
  };

  const selHols = holidaysOn(selected);
  const selOff = state.settings.weeklyOffs.includes(weekdayIdx(selected));

  return (
    <div>
      <PageHead title="Calendar & Holidays" sub="Tap any day to add a holiday — attendance marking is automatically blocked on those days" />

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
        {/* calendar */}
        <div className="card p-5 anim-fade-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setMonth(shiftPeriod(month, -1))} className="w-8 h-8 rounded-[8px] border border-ink-200 bg-white flex items-center justify-center text-ink-600 hover:border-ink-400" aria-label="Previous month"><Icon name="chevL" size={15} /></button>
              <h2 className="font-display font-bold text-[17px] text-ink-900 w-44 text-center">{periodLabel(month)}</h2>
              <button onClick={() => setMonth(shiftPeriod(month, 1))} className="w-8 h-8 rounded-[8px] border border-ink-200 bg-white flex items-center justify-center text-ink-600 hover:border-ink-400" aria-label="Next month"><Icon name="chevR" size={15} /></button>
            </div>
            <button onClick={() => { setMonth(monthKeyOf(today)); setSelected(today); }} className="text-[12px] font-bold text-ink-500 hover:text-ink-900">Today</button>
          </div>

          {/* weekly offs */}
          <div className="mb-4 rounded-[10px] bg-ink-50/70 border border-ink-100 px-3.5 py-2.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mr-1">Weekly off:</span>
            {WEEKDAYS_S.map((d, i) => {
              const on = state.settings.weeklyOffs.includes(i);
              return (
                <button key={d} onClick={() => toggleOff(i)} className={`h-7 px-2.5 rounded-[7px] text-[11.5px] font-bold transition-colors ${on ? "bg-ink-900 text-gold-300" : "bg-white border border-ink-200 text-ink-400 hover:border-ink-400"}`}>{d}</button>
              );
            })}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAYS_S.map((d) => <div key={d} className="text-center text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-ink-400 py-1">{d}</div>)}
            {cells.map((c, i) => {
              if (c.day === 0) return <div key={`e${i}`} className="aspect-square sm:aspect-auto sm:h-14" />;
              const hols = holidaysOn(c.date);
              const off = state.settings.weeklyOffs.includes(weekdayIdx(c.date));
              const isSel = c.date === selected;
              const isToday = c.date === today;
              return (
                <button key={c.date} onClick={() => setSelected(c.date)}
                  className={`relative aspect-square sm:aspect-auto sm:h-14 sm:min-h-[56px] rounded-[8px] sm:rounded-[9px] border flex flex-col items-center justify-center p-0.5 transition-all duration-150 press
                    ${isSel ? "border-gold-500 ring-2 ring-gold-500/30 shadow" : "hover:border-ink-300"}
                    ${hols.length ? "border-[#0e7490]/50 bg-[#ecf6f8]" : off ? "border-ink-100 bg-ink-50/70" : "border-ink-100 bg-white"}
                    ${isToday ? "border-ink-900" : ""}`}>
                  <span className={`text-[12px] sm:text-[13px] font-bold tnum ${hols.length ? "text-[#0e6b7c]" : isToday ? "text-white" : "text-ink-700"}`}>
                    {isToday ? <span className="inline-flex w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-ink-900 items-center justify-center text-[11px] sm:text-[12.5px]">{c.day}</span> : c.day}
                  </span>
                  {hols.length > 0 && <span className="text-[7.5px] sm:text-[8px] font-extrabold tracking-tight text-[#0e6b7c] uppercase truncate max-w-full px-0.5">{hols[0].title}</span>}
                  {hols.length === 0 && off && <span className="text-[7.5px] sm:text-[8px] font-bold text-ink-300">OFF</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[11px] font-semibold text-ink-500 flex-wrap">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-[#ecf6f8] border border-[#0e7490]/50" /> Holiday</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-ink-100 border border-ink-100" /> Weekly off</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] border-2 border-ink-900" /> Today</span>
          </div>
        </div>

        {/* day panel */}
        <div className="space-y-4 self-start">
          <div className="card p-5 anim-fade-up" style={{ animationDelay: "70ms" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-[16px] text-ink-900">{fmtDate(selected, df)}</h2>
              {selOff && <Badge tone="slate">Weekly off</Badge>}
            </div>

            {selHols.length > 0 && (
              <div className="space-y-2 mb-4">
                {selHols.map((h) => (
                  <div key={h.id} className="rounded-[10px] border border-[#0e7490]/30 bg-[#ecf6f8] px-3.5 py-2.5 space-y-2 anim-fade-in">
                    <div className="flex items-start gap-2.5">
                      <Icon name="calendar" size={15} className="text-[#0e6b7c] mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-[#0e6b7c]">{h.title} <Badge tone={h.scope === "all" ? "teal" : "gold"} className="ml-1">{h.scope === "all" ? "Whole tuition" : h.className}</Badge></p>
                        {h.reason && <p className="text-[11.5px] text-ink-500 mt-0.5">{h.reason}</p>}
                      </div>
                      <button onClick={() => setDelAsk(h.id)} className="text-ink-400 hover:text-flame-600" aria-label="Remove holiday"><Icon name="trash" size={15} /></button>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-[#0e7490]/15">
                      <Btn size="sm" variant="wa" icon="whatsapp" onClick={() => shareHoliday(h)}>
                        Notify Parents on WhatsApp
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2.5">Add a holiday on this day</h3>
            <div className="space-y-3">
              <TInput placeholder="Title — e.g. Eid, Sick leave, Personal work" value={title} onChange={(e) => setTitle(e.target.value)} />
              <TInput placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="grid grid-cols-2 gap-2.5">
                <TSelect value={scope} onChange={(e) => setScope(e.target.value as HolidayScope)}>
                  <option value="all">Whole tuition</option>
                  <option value="class">One class only</option>
                </TSelect>
                {scope === "class" ? (
                  <TSelect value={className} onChange={(e) => setClassName(e.target.value)}>
                    <option value="">Pick class…</option>
                    {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </TSelect>
                ) : (
                  <div className="h-9.5 px-3 rounded-[9px] border border-dashed border-ink-200 flex items-center text-[12px] text-ink-400">Everyone stays home</div>
                )}
              </div>
              {err && <p className="text-[12px] font-semibold text-flame-600 anim-fade-in">{err}</p>}
              <Btn variant="gold" icon="plus" className="w-full" onClick={addHoliday}>Add Holiday</Btn>
              {selected < today && <p className="text-[11px] text-warn-700 font-semibold flex items-center gap-1.5"><Icon name="alert" size={12} /> Past date — useful for correcting old records.</p>}
            </div>
          </div>

          <div className="card p-5 anim-fade-up" style={{ animationDelay: "120ms" }}>
            <h3 className="font-display font-bold text-[14.5px] text-ink-900 mb-2.5">Upcoming holidays</h3>
            {state.holidays.filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).map((h) => (
              <div key={h.id} className="flex items-center gap-2.5 py-1.5">
                <span className="font-mono text-[11.5px] font-bold text-ink-900 w-20 tnum">{fmtDate(h.date, df).slice(0, 6)}</span>
                <span className="text-[12.5px] font-semibold text-ink-700 flex-1 truncate">{h.title}</span>
                <Badge tone={h.scope === "all" ? "teal" : "gold"}>{h.scope === "all" ? "All" : h.className}</Badge>
              </div>
            ))}
            {state.holidays.filter((h) => h.date >= today).length === 0 && <p className="text-[12.5px] text-ink-400">Nothing planned.</p>}
            <p className="text-[11px] text-ink-400 mt-3 pt-3 border-t border-ink-100">Regular timing: <b className="text-ink-700 tnum">{timeLabel(state.settings.startTime)} – {timeLabel(state.settings.endTime)}</b></p>
          </div>
        </div>
      </div>

      <Confirm open={!!delAsk} onClose={() => setDelAsk(null)} onConfirm={() => delAsk && removeHoliday(delAsk)} title="Remove this holiday?" confirmLabel="Remove Holiday"
        message="Attendance can again be marked for this day. If it is a past date, students may need to be marked manually." />

      {/* Holiday WhatsApp Announcement Modal */}
      {shareHol && (
        <Modal
          open={!!shareHol}
          onClose={() => setShareHol(null)}
          title={`Notify Holiday · ${shareHol.title}`}
          sub={`${fmtDate(shareHol.date, df)} · WhatsApp message to parents`}
          wide
          footer={
            <>
              <Btn variant="outline" onClick={() => setShareHol(null)}>Ignore / Close</Btn>
              <Btn
                variant="wa"
                icon="whatsapp"
                onClick={async () => {
                  const targetStudents = shareHol.scope === "class"
                    ? state.students.filter((s) => s.grade === shareHol.className)
                    : state.students;
                  const eligibleGuards = state.guardians.filter((g) => targetStudents.some((s) => s.id === g.studentId) && selGuards.includes(g.id) && g.whatsapp);
                  if (eligibleGuards.length === 0) {
                    toast.push("Please select at least one contact.", "warn");
                    return;
                  }
                  await shareNativeOrWhatsApp({
                    title: `Holiday Notice: ${shareHol.title}`,
                    text: holMsg,
                    phone: eligibleGuards[0]?.phone,
                  });
                  patch({
                    activity: withActivity(state, `Holiday announcement "${shareHol.title}" shared on WhatsApp (${eligibleGuards.length} recipients).`, "share"),
                  });
                  toast.push(`Holiday notice shared`);
                  setShareHol(null);
                }}
              >
                Share on WhatsApp / Mobile
              </Btn>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1.5">Announcement Message (Editable)</span>
              <textarea
                value={holMsg}
                onChange={(e) => setHolMsg(e.target.value)}
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-ink-200 bg-white text-[13px] leading-relaxed focus:border-gold-500"
              />
            </div>

            <div>
              {(() => {
                const targetStudents = shareHol.scope === "class"
                  ? state.students.filter((s) => s.grade === shareHol.className && s.status === "active")
                  : state.students.filter((s) => s.status === "active");
                const eligibleGuards = state.guardians.filter((g) => targetStudents.some((s) => s.id === g.studentId) && g.whatsapp && g.phone.trim());

                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500">
                        Select Recipients ({selGuards.length}/{eligibleGuards.length})
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelGuards(eligibleGuards.map((g) => g.id))}
                          className="text-[11px] font-bold text-gold-600 hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-ink-300">·</span>
                        <button
                          type="button"
                          onClick={() => setSelGuards([])}
                          className="text-[11px] font-bold text-ink-400 hover:underline"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {eligibleGuards.length === 0 ? (
                      <p className="text-[12.5px] text-flame-600 bg-flame-50 border border-flame-100 rounded-[9px] px-3 py-2.5 font-semibold">
                        No WhatsApp contacts found for {shareHol.scope === "class" ? shareHol.className : "active students"}.
                      </p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto scroll-thin pr-1">
                        {eligibleGuards.map((g) => {
                          const s = state.students.find((x) => x.id === g.studentId);
                          const checked = selGuards.includes(g.id);
                          return (
                            <label
                              key={g.id}
                              className={`flex items-center gap-2.5 p-2.5 rounded-[9px] border cursor-pointer transition-colors ${checked ? "bg-mint-50/60 border-mint-600/30" : "bg-white border-ink-150 hover:border-ink-300"}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelGuards((prev) =>
                                    checked ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                                  );
                                }}
                                className="accent-[#12855f]"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-[12.5px] font-bold text-ink-900 truncate">{g.name} <span className="text-ink-400 font-normal">({s?.name})</span></div>
                                <div className="font-mono text-[11px] text-ink-400 tnum">{g.phone}</div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  openWhatsApp(g.phone, holMsg);
                                  toast.push(`WhatsApp opened for ${g.name}`);
                                }}
                                className="w-7 h-7 rounded-[7px] bg-[#128c5e] text-white flex items-center justify-center press shrink-0"
                                title={`Send to ${g.name}`}
                              >
                                <Icon name="whatsapp" size={13} />
                              </button>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
