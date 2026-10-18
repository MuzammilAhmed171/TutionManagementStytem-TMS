import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { PageKey, Route } from "../types";
import { useStore, withActivity } from "../lib/store";
import { balanceOf, challanNo, ensureFeeRecords, periodStats } from "../lib/fee";
import { absentMessage, buildTimingNotice, deriveNotices, whatsappGuardians } from "../lib/notify";
import { currentPeriod, fmtMoney, naturalCompare, openWhatsApp, periodLabel, shareNativeOrWhatsApp, timeLabel, todayISO, waLink } from "../lib/utils";
import { AppLogo, Badge, Btn, Confirm, Icon, Modal, TInput, TutorAvatar, useToast } from "./ui";
import SlipModal, { type SlipTarget } from "./SlipModal";
import PaymentModal from "./PaymentModal";
import StudentForm from "./StudentForm";

/* ---------- routing + global UI context ---------- */

const NavCtx = createContext<{ route: Route; nav: (p: PageKey, params?: Record<string, string>) => void } | null>(null);
export function useNav() {
  const v = useContext(NavCtx);
  if (!v) throw new Error("NavCtx missing");
  return v;
}

interface UiCtx {
  openSlip: (t: SlipTarget) => void;
  openPayment: (studentId?: string, paymentId?: string) => void;
  openStudentForm: (opts?: { editId?: string; presetClass?: string }) => void;
}
const Ui = createContext<UiCtx | null>(null);
export function useUi() {
  const v = useContext(Ui);
  if (!v) throw new Error("UiCtx missing");
  return v;
}

const NAV: { key: PageKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "students", label: "Students", icon: "students" },
  { key: "classes", label: "Classes", icon: "classes" },
  { key: "attendance", label: "Attendance", icon: "attendance" },
  { key: "fees", label: "Fees & Payments", icon: "fees" },
  { key: "slips", label: "Fee Slips", icon: "slips" },
  { key: "calendar", label: "Calendar & Holidays", icon: "calendar" },
  { key: "reports", label: "Reports", icon: "reports" },
  { key: "settings", label: "Settings", icon: "settings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, patch, logout } = useStore();
  const toast = useToast();
  const [route, setRoute] = useState<Route>({ page: "dashboard", n: 0 });
  const [history, setHistory] = useState<Route[]>([{ page: "dashboard", n: 0 }]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [askLogout, setAskLogout] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  /* hide bottom navigation when soft keyboard is active */
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        setIsKeyboardOpen(true);
      }
    };
    const onFocusOut = () => {
      setIsKeyboardOpen(false);
    };
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);

    const handleViewportResize = () => {
      if (window.visualViewport) {
        if (window.innerHeight - window.visualViewport.height > 120) {
          setIsKeyboardOpen(true);
        } else {
          setIsKeyboardOpen(false);
        }
      }
    };
    window.visualViewport?.addEventListener("resize", handleViewportResize);

    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
    };
  }, []);

  /* dismissable notices state (persisted in session) */
  const [dismissedNoticeKeys, setDismissedNoticeKeys] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("tms_dismissed_notices") || "[]");
    } catch {
      return [];
    }
  });

  const dismissNotice = (key: string) => {
    setDismissedNoticeKeys((prev) => {
      const next = [...new Set([...prev, key])];
      try {
        sessionStorage.setItem("tms_dismissed_notices", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  /* global modal requests */
  const [formReq, setFormReq] = useState<{ open: boolean; editId?: string; presetClass?: string }>({ open: false });
  const [payReq, setPayReq] = useState<{ open: boolean; studentId?: string; paymentId?: string }>({ open: false });
  const [slipTarget, setSlipTarget] = useState<SlipTarget | null>(null);

  const nav = (page: PageKey, params?: Record<string, string>) => {
    setRoute((r) => {
      const next: Route = { page, params, n: r.n + 1 };
      setHistory((h) => [...h, next]);
      return next;
    });
    setSheetOpen(false);
    setMobileSearch(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* lock body scroll when mobile sheet is open */
  useEffect(() => {
    if (sheetOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [sheetOpen]);

  /* multi-tier back handler */
  const handleBack = (): boolean => {
    if (askLogout) { setAskLogout(false); return true; }
    if (formReq.open) { setFormReq({ open: false }); return true; }
    if (payReq.open) { setPayReq({ open: false }); return true; }
    if (slipTarget) { setSlipTarget(null); return true; }
    if (bellOpen) { setBellOpen(false); return true; }
    if (sheetOpen) { setSheetOpen(false); return true; }
    if (mobileSearch) { setMobileSearch(false); return true; }

    if (history.length > 1) {
      const nextHistory = [...history];
      nextHistory.pop();
      const prev = nextHistory[nextHistory.length - 1];
      setHistory(nextHistory);
      setRoute(prev);
      window.scrollTo({ top: 0 });
      return true;
    }

    if (route.page !== "dashboard") {
      const home = { page: "dashboard" as const, n: route.n + 1 };
      setHistory([home]);
      setRoute(home);
      window.scrollTo({ top: 0 });
      return true;
    }

    return false;
  };

  /* hardware & gesture back button listener */
  useEffect(() => {
    let lastBack = 0;

    const onBackPress = () => {
      const handled = handleBack();
      if (!handled) {
        const now = Date.now();
        if (now - lastBack < 2000) {
          if (Capacitor.isNativePlatform()) {
            CapacitorApp.exitApp();
          }
        } else {
          lastBack = now;
          toast.push("Press back again to exit", "warn");
        }
      }
    };

    let capHandle: any = null;
    if (Capacitor.isPluginAvailable("App")) {
      CapacitorApp.addListener("backButton", onBackPress).then((h) => {
        capHandle = h;
      });
    }

    const onPop = () => {
      const handled = handleBack();
      if (handled) {
        window.history.pushState({ page: route.page }, "");
      }
    };

    window.history.pushState({ page: route.page }, "");
    window.addEventListener("popstate", onPop);

    return () => {
      if (capHandle && capHandle.remove) capHandle.remove();
      window.removeEventListener("popstate", onPop);
    };
  }, [formReq, payReq, slipTarget, bellOpen, sheetOpen, mobileSearch, history, route]);

  /* auto-generate fee records when a new month starts (runs while app is open) */
  useEffect(() => {
    const run = () => {
      const res = ensureFeeRecords(state);
      if (res.added > 0 || res.late > 0) {
        patch({
          feeRecords: res.records,
          activity: withActivity({ ...state, feeRecords: res.records }, `New month — ${res.added} fee challan(s) auto-generated.${res.late ? ` Late fee applied to ${res.late} overdue record(s).` : ""}`, "fee"),
        });
        if (res.added > 0) toast.push(`${res.added} challan(s) generated for ${periodLabel(currentPeriod())}`, "ok");
      }
    };
    run();
    const t = setInterval(run, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ui: UiCtx = useMemo(() => ({
    openSlip: (t) => {
      if (t.kind === "challan") {
        const rec = state.feeRecords.find((r) => r.id === t.recordId);
        if (rec && balanceOf(rec, state.payments) <= 0 && !rec.waived) {
          toast.push("Fee is fully paid — no challan needed. Send a receipt instead.", "warn");
          return;
        }
      }
      setSlipTarget(t);
    },
    openPayment: (studentId, paymentId) => setPayReq({ open: true, studentId, paymentId }),
    openStudentForm: (opts) => setFormReq({ open: true, ...opts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state]);

  const notices = useMemo(() => {
    return deriveNotices(state).filter((n) => !dismissedNoticeKeys.includes(n.key));
  }, [state, dismissedNoticeKeys]);

  return (
    <NavCtx.Provider value={{ route, nav }}>
      <Ui.Provider value={ui}>
        <div className="min-h-screen bg-ledger">
          {/* ---------- desktop sidebar ---------- */}
          <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[236px] bg-ink-900 text-ink-200 z-30">
            <div className="px-5 pt-6 pb-5 border-b border-ink-800">
              <div className="flex items-center gap-3">
                <AppLogo size={36} />
                <div className="min-w-0">
                  <div className="font-display font-bold text-[15.5px] text-white leading-tight truncate">{state.settings.tuitionName}</div>
                  <div className="text-[9.5px] font-bold tracking-[0.22em] text-gold-400 mt-0.5">TUITION DESK</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-800">
              <TutorAvatar size={38} photo={state.settings.tutorPhoto} />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-white truncate">{state.settings.tutorName}</div>
                <div className="text-[10.5px] text-ink-400">Owner · Tutor</div>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scroll-thin">
              {NAV.map((n) => {
                const active = route.page === n.key || (n.key === "students" && route.page === "student");
                return (
                  <button key={n.key} onClick={() => nav(n.key)}
                    className={`w-full flex items-center gap-3 px-3 h-10 rounded-[9px] text-[13.5px] font-semibold transition-all duration-150 ${active ? "bg-ink-800 text-white shadow-inner" : "text-ink-300 hover:bg-ink-850 hover:text-white"}`}>
                    <Icon name={n.icon} size={17} className={active ? "text-gold-400" : ""} />
                    {n.label}
                    {n.key === "fees" && notices.filter((x) => x.kind === "overdue").length > 0 && (
                      <span className="ml-auto text-[10px] font-bold bg-flame-600 text-white rounded-full px-1.5 py-0.5 tnum">{notices.filter((x) => x.kind === "overdue").length}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-ink-800">
              <button onClick={() => setAskLogout(true)} className="w-full flex items-center gap-3 px-3 h-10 rounded-[9px] text-[13px] font-semibold text-ink-300 hover:bg-flame-600/15 hover:text-flame-500 transition-colors">
                <Icon name="logout" size={17} /> Log out
              </button>
            </div>
          </aside>

          {/* ---------- header : [ Brand ] —— [ Search ] [ Bell | Profile ] ---------- */}
          <header className="fixed top-0 left-0 lg:left-[236px] right-0 z-40 bg-white/95 backdrop-blur border-b border-ink-100 shadow-[0_1px_3px_rgba(14,24,48,0.05)] w-full max-w-full pt-[max(env(safe-area-inset-top,0px),4px)] sm:pt-0">
            {/* subtle top gradient scrim for status bar / battery / clock visibility on mobile */}
            <div
              className="sm:hidden absolute top-0 inset-x-0 h-[max(env(safe-area-inset-top,0px),26px)] pointer-events-none bg-gradient-to-b from-ink-950/25 via-ink-900/10 to-transparent z-10"
              aria-hidden="true"
            />
            <div className="w-full max-w-full relative z-20">
              <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 px-3 sm:px-6 h-[56px] sm:h-[60px] w-full max-w-full">
                {/* menu (mobile only) */}
                <button className="lg:hidden w-9 h-9 shrink-0 rounded-[9px] border border-ink-200 bg-white flex items-center justify-center text-ink-700 hover:border-ink-400 transition-colors" onClick={() => setSheetOpen(true)} aria-label="Open menu">
                  <Icon name="menu" size={18} />
                </button>

                {/* brand — non-clickable display header */}
                <div title={state.settings.tuitionName} className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink flex-1 md:flex-initial select-none lg:hidden">
                  <AppLogo size={34} />
                  <span className="min-w-0 text-left truncate flex-1">
                    <span className="block font-display font-bold text-[13.5px] sm:text-[15px] leading-tight text-ink-900 truncate max-w-[125px] xs:max-w-[165px] sm:max-w-[220px] md:max-w-[280px]">{state.settings.tuitionName}</span>
                    <span className="hidden sm:block text-[8.5px] font-bold tracking-[0.24em] text-gold-600 mt-0.5">TUITION MANAGEMENT</span>
                  </span>
                </div>

                {/* global search — left-aligned, capped so it never dominates */}
                <div className="hidden md:flex flex-1 min-w-0 px-1 lg:px-2">
                  <GlobalSearch className=" w-full max-w-[300px] lg:max-w-[400px]" />
                </div>

                {/* actions — right */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto mr-75 flex-nowrap">
                  <button className={`md:hidden w-9 h-9 shrink-0 rounded-[9px] border flex items-center justify-center transition-colors ${mobileSearch ? "bg-ink-900 text-white border-ink-900" : "border-ink-200 bg-white text-ink-600 hover:border-ink-400"}`} onClick={() => setMobileSearch(!mobileSearch)} aria-label="Search">
                    <Icon name={mobileSearch ? "x" : "search"} size={17} />
                  </button>

                  {/* notifications bell */}
                  <div className="relative shrink-0">
                    <button onClick={() => setBellOpen(!bellOpen)} aria-label="Notifications"
                      className={`relative w-9 h-9 rounded-[9px] border flex items-center justify-center transition-colors ${bellOpen ? "bg-ink-900 text-white border-ink-900" : "bg-white border-ink-200 text-ink-600 hover:border-ink-400"}`}>
                      <Icon name="bell" size={17} />
                      {notices.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-flame-600 text-white text-[10px] font-bold flex items-center justify-center tnum anim-tick">{notices.length}</span>
                      )}
                    </button>
                    {bellOpen && <NotificationsPanel notices={notices} onDismiss={dismissNotice} onClose={() => setBellOpen(false)} />}
                  </div>

                  <span className="hidden sm:block w-px h-6 bg-ink-150 shrink-0" aria-hidden="true" />

                  {/* profile */}
                  <button onClick={() => nav("settings")} title="Profile & settings" className="group flex items-center gap-2 rounded-[10px] p-1 hover:bg-ink-50 transition-colors shrink-0">
                    <TutorAvatar size={34} photo={state.settings.tutorPhoto} />
                    <span className="hidden sm:block text-left">
                      <span className="block text-[12.5px] font-bold leading-tight text-ink-900 max-w-[110px] truncate">{state.settings.tutorName}</span>
                      <span className="block text-[10px] font-semibold text-ink-400">Owner · Tutor</span>
                    </span>
                    <Icon name="chevD" size={13} className="hidden sm:block text-ink-300 group-hover:text-ink-600 transition-colors" />
                  </button>
                </div>
              </div>
              {mobileSearch && (
                <div className="md:hidden px-3 pb-3 pt-1 border-t border-ink-100 anim-fade-in">
                  <GlobalSearch autoFocus onDone={() => setMobileSearch(false)} />
                </div>
              )}
            </div>
          </header>

          {/* ---------- mobile sheet drawer with smooth slide in/out animation ---------- */}
          <div className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${sheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
            <div
              className={`absolute inset-0 bg-ink-950/60 transition-opacity duration-300 ${sheetOpen ? "opacity-100" : "opacity-0"}`}
              onClick={() => setSheetOpen(false)}
            />
            <div
              className={`absolute inset-y-0 left-0 w-[270px] bg-ink-900 text-ink-200 flex flex-col shadow-2xl transition-transform duration-300 ease-out pt-[max(env(safe-area-inset-top,0px),4px)] ${sheetOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
              <div className="px-5 py-4 border-b border-ink-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AppLogo size={30} />
                  <span className="font-display font-bold text-white text-[15px]">Tuition Desk</span>
                </div>
                <button onClick={() => setSheetOpen(false)} className="text-ink-400 hover:text-white" aria-label="Close menu"><Icon name="x" size={18} /></button>
              </div>
              <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
                {NAV.map((n) => {
                  const active = route.page === n.key || (n.key === "students" && route.page === "student");
                  return (
                    <button key={n.key} onClick={() => { nav(n.key); setSheetOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 h-10.5 rounded-[9px] text-[14px] font-semibold transition-colors ${active ? "bg-ink-800 text-white" : "text-ink-300 hover:bg-ink-850"}`}>
                      <Icon name={n.icon} size={17} className={active ? "text-gold-400" : ""} /> {n.label}
                    </button>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-ink-800 pb-[max(env(safe-area-inset-bottom,0px),12px)]">
                <button onClick={() => { setSheetOpen(false); setAskLogout(true); }} className="w-full flex items-center gap-3 px-3 h-10 rounded-[9px] text-[13px] font-semibold text-ink-300 hover:bg-flame-600/15 hover:text-flame-500 transition-colors">
                  <Icon name="logout" size={17} /> Log out
                </button>
              </div>
            </div>
          </div>

          <main className="lg:pl-[236px] pt-[calc(max(env(safe-area-inset-top,0px),4px)+56px)] sm:pt-[60px] pb-28 lg:pb-10 w-full max-w-full overflow-x-hidden">
            <div className="max-w-[1200px] mx-auto px-3.5 sm:px-7 pt-5 sm:pt-6 w-full max-w-full" key={`${route.page}-${route.n}`}>
              {children}
            </div>
          </main>

          {/* ---------- mobile bottom nav ---------- */}
          <nav className={`lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-ink-150 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] grid grid-cols-5 w-full max-w-full items-center px-1 pt-1 pb-[max(env(safe-area-inset-bottom,0px),8px)] transition-transform duration-200 ${isKeyboardOpen ? "translate-y-full pointer-events-none" : "translate-y-0"}`}>
            {[
              { key: "students" as PageKey, label: "Students", icon: "students" },
              { key: "attendance" as PageKey, label: "Attendance", icon: "attendance" },
              { key: "dashboard" as PageKey, label: "Home", icon: "dashboard", isCenter: true },
              { key: "fees" as PageKey, label: "Fees", icon: "fees" },
              { key: "settings" as PageKey, label: "Settings", icon: "settings" },
            ].map((n) => {
              const active = route.page === n.key || (n.key === "students" && route.page === "student");

              if (n.isCenter) {
                return (
                  <button
                    key={n.key}
                    type="button"
                    onClick={() => nav(n.key)}
                    className="flex flex-col items-center justify-center -mt-4 group relative press focus:outline-none"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 ${active ? "bg-gold-500 text-ink-950 shadow-gold-500/30 scale-105 ring-4 ring-white" : "bg-ink-900 text-gold-300 hover:bg-ink-800 shadow-ink-950/20"}`}>
                      <Icon name={n.icon} size={22} strokeWidth={2.4} />
                    </div>
                    <span className={`text-[10.5px] font-bold mt-1 tracking-tight ${active ? "text-gold-700 font-extrabold" : "text-ink-600"}`}>
                      {n.label}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => nav(n.key)}
                  className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all press min-h-[50px] focus:outline-none ${active ? "text-ink-950" : "text-ink-400 hover:text-ink-700"}`}
                >
                  <span className={`w-11 h-7 rounded-full flex items-center justify-center transition-colors ${active ? "bg-gold-100 text-gold-800 font-bold" : "text-ink-400"}`}>
                    <Icon name={n.icon} size={20} strokeWidth={active ? 2.3 : 1.9} />
                  </span>
                  <span className={`text-[11px] mt-0.5 tracking-tight ${active ? "font-extrabold text-ink-900" : "font-semibold"}`}>
                    {n.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* ---------- global modals (open on top of the current page) ---------- */}
          <PaymentModal
            open={payReq.open}
            studentId={payReq.studentId}
            paymentId={payReq.paymentId}
            onClose={() => setPayReq({ open: false })}
            onSendReceipt={(paymentId) => { setPayReq({ open: false }); setSlipTarget({ kind: "receipt", paymentId }); }}
          />
          <SlipModal target={slipTarget} onClose={() => setSlipTarget(null)} />
          <StudentForm
            open={formReq.open}
            editId={formReq.editId}
            presetClass={formReq.presetClass}
            onClose={() => setFormReq({ open: false })}
          />
          <Confirm
            open={askLogout}
            onClose={() => setAskLogout(false)}
            onConfirm={() => { setAskLogout(false); logout(); }}
            title="Log out of Tuition Desk?"
            confirmLabel="Log Out"
            message="You will be returned to the login screen. All your data stays saved safely on this device."
          />
        </div>
      </Ui.Provider>
    </NavCtx.Provider>
  );
}

/* ================= global search ================= */

function GlobalSearch({ className = "", autoFocus, onDone }: { className?: string; autoFocus?: boolean; onDone?: () => void }) {
  const { state } = useStore();
  const { nav } = useNav();
  const ui = useUi();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent | TouchEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", h);
    window.addEventListener("touchstart", h);
    return () => {
      window.removeEventListener("mousedown", h);
      window.removeEventListener("touchstart", h);
    };
  }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return null;
    const students = state.students.filter((s) => {
      const gInfo = state.guardians
        .filter((g) => g.studentId === s.id)
        .map((g) => `${g.name} ${g.phone.replace(/\D/g, "")}`)
        .join(" ");
      return `${s.name} ${s.id} ${s.grade} ${s.school ?? ""} ${s.address ?? ""} ${gInfo}`
        .toLowerCase()
        .includes(query);
    }).slice(0, 6);

    const challans = state.feeRecords
      .filter((r) => {
        const s = state.students.find((x) => x.id === r.studentId);
        const no = challanNo(state.feeRecords, r.id).toLowerCase();
        return (
          no.includes(query) ||
          r.period.toLowerCase().includes(query) ||
          (s?.name.toLowerCase().includes(query) ?? false)
        );
      })
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 5);

    const receipts = state.payments
      .filter((p) => {
        const s = state.students.find((x) => x.id === p.studentId);
        return (
          p.receiptNo.toLowerCase().includes(query) ||
          p.date.includes(query) ||
          (s?.name.toLowerCase().includes(query) ?? false)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    return { students, challans, receipts };
  }, [q, state]);

  const pick = (fn: () => void) => {
    fn();
    setQ("");
    setOpen(false);
    onDone?.();
  };
  const cur = state.settings.feePolicy.currency;

  return (
    <div className={`relative ${className}`} ref={boxRef}>
      <div className="relative flex items-center">
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search students, class, phone, challan, receipt…"
          className="w-full h-10 pl-9 pr-9 rounded-[10px] border border-ink-200 bg-white text-[13.5px] placeholder:text-ink-300 focus:border-gold-500 shadow-sm"
        />
        {q ? (
          <button
            type="button"
            onClick={() => { setQ(""); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-ink-100 hover:bg-ink-200 text-ink-600 flex items-center justify-center transition-colors"
            aria-label="Clear search"
          >
            <Icon name="x" size={13} />
          </button>
        ) : null}
      </div>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 card overflow-hidden z-50 shadow-2xl border border-ink-200/90 anim-pop max-h-[65vh] sm:max-h-[420px] overflow-y-auto scroll-thin bg-white">
          {!results ? (
            /* When empty / focused, show quick access recent students or instructions */
            <div className="p-3">
              <p className="text-[10px] font-bold tracking-[0.14em] text-ink-400 px-2 py-1 uppercase">Quick Jump · Students</p>
              {state.students.slice(0, 5).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pick(() => nav("student", { id: s.id })); }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 hover:bg-gold-50 rounded-[8px] text-left transition-colors"
                >
                  <Icon name="user" size={15} className="text-gold-600" />
                  <span className="flex-1 text-[13px] font-semibold text-ink-900 truncate">{s.name}</span>
                  <span className="text-[11px] font-medium text-ink-400 shrink-0">{s.grade}</span>
                </button>
              ))}
              {state.students.length === 0 && (
                <p className="text-[12px] text-ink-400 px-2 py-2">Type a name, roll no, phone or challan # to search.</p>
              )}
            </div>
          ) : results.students.length === 0 && results.challans.length === 0 && results.receipts.length === 0 ? (
            <p className="text-[12.5px] text-ink-400 px-4 py-6 text-center">Nothing matches “{q}”. Try a name, grade, phone, CHL-1001 or RCP-1001.</p>
          ) : (
            <>
              {results.students.length > 0 && (
                <div>
                  <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.14em] text-ink-400">STUDENTS ({results.students.length})</p>
                  {results.students.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); pick(() => nav("student", { id: s.id })); }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-gold-50 text-left transition-colors border-b border-ink-50 last:border-0"
                    >
                      <span className="w-7 h-7 rounded-full bg-gold-100 text-gold-800 flex items-center justify-center font-bold text-[11px] shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink-900 truncate">{s.name}</div>
                        <div className="text-[10.5px] text-ink-400 truncate">{s.grade} {s.school ? `· ${s.school}` : ""}</div>
                      </div>
                      <Icon name="chevR" size={13} className="text-ink-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {results.challans.length > 0 && (
                <div className="border-t border-ink-100">
                  <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.14em] text-ink-400">FEE CHALLANS ({results.challans.length})</p>
                  {results.challans.map((r) => {
                    const s = state.students.find((x) => x.id === r.studentId);
                    const bal = balanceOf(r, state.payments);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); pick(() => ui.openSlip({ kind: "challan", recordId: r.id })); }}
                        className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gold-50 text-left transition-colors border-b border-ink-50 last:border-0"
                      >
                        <Icon name="slips" size={15} className="text-gold-600 shrink-0" />
                        <div className="flex-1 min-w-0 text-[12.5px]">
                          <span className="font-mono font-bold text-[12px]">{challanNo(state.feeRecords, r.id)}</span>
                          <span className="text-ink-500"> · {s?.name} · {periodLabel(r.period, true)}</span>
                        </div>
                        <span className={`font-mono text-[11.5px] font-bold tnum shrink-0 ${bal > 0 ? "text-flame-600" : "text-mint-600"}`}>
                          {bal > 0 ? fmtMoney(bal, cur) : "Paid"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {results.receipts.length > 0 && (
                <div className="border-t border-ink-100">
                  <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.14em] text-ink-400">PAYMENT RECEIPTS ({results.receipts.length})</p>
                  {results.receipts.map((p) => {
                    const s = state.students.find((x) => x.id === p.studentId);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); pick(() => ui.openSlip({ kind: "receipt", paymentId: p.id })); }}
                        className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-gold-50 text-left transition-colors border-b border-ink-50 last:border-0"
                      >
                        <Icon name="receipt" size={15} className="text-mint-600 shrink-0" />
                        <div className="flex-1 min-w-0 text-[12.5px]">
                          <span className="font-mono font-bold text-[12px]">{p.receiptNo}</span>
                          <span className="text-ink-500"> · {s?.name} · {p.date}</span>
                        </div>
                        <span className="font-mono text-[11.5px] font-bold text-mint-600 tnum shrink-0">
                          {fmtMoney(p.amount, cur)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= notifications panel ================= */

function NotificationsPanel({ notices, onDismiss, onClose }: { notices: ReturnType<typeof deriveNotices>; onDismiss: (k: string) => void; onClose: () => void }) {
  const { state, patch } = useStore();
  const ui = useUi();
  const { nav } = useNav();
  const toast = useToast();
  const [composer, setComposer] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const cur = state.settings.feePolicy.currency;
  const df = state.settings.dateFormat;

  const kindMeta: Record<string, { icon: string; cls: string; label: string }> = {
    timing: { icon: "clock", cls: "bg-[#ecf6f8] text-[#0e6b7c]", label: "Timing change" },
    overdue: { icon: "alert", cls: "bg-flame-50 text-flame-600", label: "Overdue" },
    absent: { icon: "x", cls: "bg-warn-50 text-warn-600", label: "Absent today" },
    challan: { icon: "slips", cls: "bg-gold-50 text-gold-600", label: "Challan ready" },
    "due-soon": { icon: "clock", cls: "bg-gold-50 text-gold-600", label: "Due soon" },
    info: { icon: "note", cls: "bg-ink-50 text-ink-500", label: "Info" },
  };

  const deleteNotice = (id: string) => {
    patch({ notifications: state.notifications.filter((n) => n.id !== id) });
    toast.push("Timing notice removed");
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-50 bg-ink-950/50 anim-fade-in" onClick={onClose} />
      {/* Notifications panel: positioned right under the header on mobile & desktop */}
      <div
        className="fixed z-50 top-[calc(max(env(safe-area-inset-top,0px),4px)+60px)] sm:top-16 inset-x-3 sm:inset-x-auto sm:right-6 sm:w-[420px] max-h-[calc(100dvh-5rem)] rounded-2xl bg-white border border-ink-100 shadow-2xl flex flex-col overflow-hidden anim-pop"
      >
        <div className="px-4 py-3 bg-ink-900 flex items-center justify-between gap-2 shrink-0">
          <span className="font-display font-bold text-[14.5px] text-white flex items-center gap-2">
            <Icon name="bell" size={15} className="text-gold-400" /> Notifications
            {notices.length > 0 && (
              <span className="text-[10.5px] font-bold bg-flame-600 text-white rounded-full px-1.5 py-0.2 tnum">
                {notices.length}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <Btn size="sm" variant="gold" icon="plus" onClick={() => setComposer(true)}>Timing Change</Btn>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-[7px] text-ink-300 hover:text-white hover:bg-ink-800 flex items-center justify-center transition-colors"
              aria-label="Close notifications"
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin overscroll-contain">
          {notices.length === 0 && (
            <p className="text-[12.5px] text-ink-400 text-center px-6 py-10">All clear — no challans pending, no overdue fees, no absentees today.</p>
          )}
          {notices.map((n) => {
            const meta = kindMeta[n.kind];
            const notice = n.kind === "timing" ? state.notifications.find((x) => x.id === n.noticeId) : undefined;
            const isOpen = expanded === n.key;
            return (
              <div key={n.key} className="px-4 py-3 border-b border-ink-100 last:border-0 anim-fade-in">
                <div className="flex items-start gap-3">
                  <span className={`w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 ${meta.cls}`}><Icon name={meta.icon} size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-ink-900 leading-snug">{n.title}</span>
                      <Badge tone={n.kind === "overdue" ? "red" : n.kind === "absent" ? "amber" : n.kind === "timing" ? "teal" : "gold"}>{meta.label}</Badge>
                    </div>
                    <p className="text-[12px] text-ink-500 mt-0.5 leading-snug">{n.body}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {n.kind === "challan" && n.recordId && (
                        <>
                          <Btn size="sm" variant="gold" icon="send" onClick={() => { ui.openSlip({ kind: "challan", recordId: n.recordId! }); onClose(); }}>Send Challan</Btn>
                          <Btn size="sm" variant="ghost" icon="x" onClick={() => onDismiss(n.key)}>Ignore</Btn>
                        </>
                      )}
                      {n.kind === "overdue" && n.recordId && (
                        <>
                          <Btn size="sm" variant="outline" icon="wallet" onClick={() => { ui.openPayment(n.studentId); onClose(); }}>Record Payment</Btn>
                          <Btn size="sm" variant="ghost" icon="slips" onClick={() => { ui.openSlip({ kind: "challan", recordId: n.recordId! }); onClose(); }}>Challan</Btn>
                          <Btn size="sm" variant="ghost" icon="x" onClick={() => onDismiss(n.key)}>Ignore</Btn>
                        </>
                      )}
                      {n.kind === "absent" && n.studentId && (
                        (() => {
                          const s = state.students.find((x) => x.id === n.studentId);
                          const wg = s ? whatsappGuardians(state, s.id) : [];
                          return (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {wg.map((g) => (
                                <Btn
                                  key={g.id}
                                  size="sm"
                                  variant="wa"
                                  icon="whatsapp"
                                  onClick={() => {
                                    openWhatsApp(g.phone, absentMessage(state, s!));
                                    onDismiss(n.key);
                                    toast.push(`WhatsApp opened for ${g.name} ✓`);
                                  }}
                                >
                                  {g.name}
                                </Btn>
                              ))}
                              {wg.length === 0 && <span className="text-[11px] text-ink-400 font-semibold mr-1">No WhatsApp number</span>}
                              <Btn size="sm" variant="ghost" icon="x" onClick={() => onDismiss(n.key)}>Ignore</Btn>
                            </div>
                          );
                        })()
                      )}
                      {n.kind === "due-soon" && (
                        <>
                          {n.recordId && <Btn size="sm" variant="ghost" icon="slips" onClick={() => { ui.openSlip({ kind: "challan", recordId: n.recordId! }); onClose(); }}>Challan</Btn>}
                          <Btn size="sm" variant="ghost" icon="x" onClick={() => onDismiss(n.key)}>Ignore</Btn>
                        </>
                      )}
                      {n.kind === "timing" && notice && (
                        <Btn size="sm" variant="outline" icon={isOpen ? "chevD" : "chevR"} onClick={() => setExpanded(isOpen ? null : n.key)}>{isOpen ? "Hide" : "View & Send"}</Btn>
                      )}
                    </div>
                    {n.kind === "timing" && notice && isOpen && (
                      <div className="mt-2.5 rounded-[10px] border border-ink-150 bg-ink-50/70 p-3 anim-fade-in">
                        <pre className="whitespace-pre-wrap font-sans text-[11.5px] text-ink-700 leading-relaxed">{notice.message}</pre>
                        {(() => {
                          const contacts = state.guardians.filter((g) => g.whatsapp && g.phone.trim()).slice(0, 40);
                          const sentList = notice.sentTo || [];

                          const sendOne = (g: typeof contacts[0]) => {
                            openWhatsApp(g.phone, notice.message);
                            if (!sentList.includes(g.name)) {
                              const nextSent = [...sentList, g.name];
                              const next = { ...state, notifications: state.notifications.map((x) => (x.id === notice.id ? { ...x, sentTo: nextSent } : x)) };
                              patch({ notifications: next.notifications, activity: withActivity(next, `Timing change notice sent to ${g.name}.`, "notice") });
                            }
                            toast.push(`WhatsApp opened for ${g.name} ✓`);
                          };

                          const shareAll = async () => {
                            if (contacts.length === 0) { toast.push("No WhatsApp numbers saved.", "warn"); return; }
                            const ok = await shareNativeOrWhatsApp({
                              title: notice.title,
                              text: notice.message,
                            });
                            if (ok) {
                              const sentTo = contacts.map((g) => g.name);
                              const next = { ...state, notifications: state.notifications.map((x) => (x.id === notice.id ? { ...x, sentTo } : x)) };
                              patch({ notifications: next.notifications, activity: withActivity(next, `Timing change notice "${notice.title}" shared on WhatsApp.`, "notice") });
                              toast.push(`Timing notice shared ✓`);
                            }
                          };

                          return (
                            <>
                              <div className="flex items-center justify-between mt-3 mb-1.5">
                                <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Recipients ({contacts.length})</p>
                                <span className="text-[11px] font-bold text-mint-700 tnum">{sentList.length}/{contacts.length} Sent</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {contacts.map((g) => {
                                  const isSent = sentList.includes(g.name);
                                  return (
                                    <button key={g.id} onClick={() => sendOne(g)}
                                      className={`inline-flex items-center gap-1 h-7 px-2 rounded-[7px] text-[10.5px] font-bold press transition-colors ${isSent ? "bg-mint-50 text-mint-700 border border-mint-600/30" : "bg-[#128c5e] text-white hover:bg-[#0e7a50]"}`}>
                                      <Icon name={isSent ? "check" : "whatsapp"} size={11} /> {isSent ? `Sent: ${g.name}` : g.name}
                                    </button>
                                  );
                                })}
                                {contacts.length === 0 && <span className="text-[11px] text-flame-600 font-semibold">No WhatsApp numbers saved yet.</span>}
                              </div>
                              <div className="flex flex-col gap-2 mt-3 [&>*]:w-full">
                                <Btn size="sm" variant="wa" icon="whatsapp" onClick={shareAll} disabled={contacts.length === 0}>Share Notice on WhatsApp / Mobile</Btn>
                                {notice.sentTo.length > 0 && (
                                  <span className="inline-flex items-center justify-center gap-1.5 text-[11.5px] font-bold text-mint-700 bg-mint-50 border border-mint-600/25 rounded-[8px] py-1.5 anim-tick">
                                    <Icon name="check" size={13} /> Sent to {notice.sentTo.length} contacts
                                  </span>
                                )}
                                <Btn size="sm" variant="ghost" icon="trash" onClick={() => deleteNotice(notice.id)}>Remove Notice</Btn>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2.5 bg-ink-50/70 border-t border-ink-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-ink-400 font-semibold">Today · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          <button onClick={() => { nav("attendance"); onClose(); }} className="text-[11.5px] font-bold text-ink-600 hover:text-ink-900">Mark attendance →</button>
        </div>
      </div>
      <TimingComposer open={composer} onClose={() => setComposer(false)} />
    </>,
    document.body
  );
}

/* ================= timing-change composer ================= */

function TimingComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, patch } = useStore();
  const toast = useToast();
  const [startDate, setStartDate] = useState(todayISO());
  const [days, setDays] = useState(3);
  const [startTime, setStartTime] = useState(state.settings.startTime);
  const [endTime, setEndTime] = useState(state.settings.endTime);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const preview = useMemo(
    () => buildTimingNotice({ startDate, days, startTime, endTime, note: note || undefined }, state).message,
    [startDate, days, startTime, endTime, note, state]
  );

  const save = () => {
    if (days < 1 || days > 60) { setErr("Days must be between 1 and 60."); return; }
    if (!startTime || !endTime) { setErr("Please set the new start and end time."); return; }
    const n = buildTimingNotice({ startDate, days, startTime, endTime, note: note || undefined }, state);
    patch({
      notifications: [n, ...state.notifications],
      activity: withActivity({ ...state }, `Timing change notice created: ${timeLabel(startTime)}–${timeLabel(endTime)} for ${days} day(s) from ${startDate}.`, "notice"),
    });
    toast.push("Timing change saved — now send it from the notification panel");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Change Tuition Timing (Temporary)" sub="Create a notice, then send it to every parent on WhatsApp" wide
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="gold" icon="bell" onClick={save}>Save Notice</Btn></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">Starts from</span>
          <TInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">For how many days?</span>
          <TInput type="number" min={1} max={60} value={days} onChange={(e) => setDays(parseInt(e.target.value, 10) || 1)} />
        </label>
        <div className="sm:col-span-2">
          <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-2">Quick pick — days</span>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 5, 7, 15].map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)}
                className={`h-8 px-3.5 rounded-[8px] text-[12px] font-bold border transition-colors press ${days === d ? "bg-ink-900 text-gold-300 border-ink-900" : "bg-white border-ink-200 text-ink-600 hover:border-ink-400"}`}>
                {d} day{d > 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">New start time</span>
          <TInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">New end time</span>
          <TInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-2">Quick pick — timing</span>
          <div className="flex flex-wrap gap-1.5">
            {[["08:00", "10:00"], ["14:00", "16:00"], ["15:00", "17:00"], ["16:00", "18:00"], ["17:00", "19:00"], ["18:00", "20:00"]].map(([a, b]) => (
              <button key={a} type="button" onClick={() => { setStartTime(a); setEndTime(b); }}
                className={`h-8 px-3 rounded-[8px] text-[12px] font-bold border transition-colors press tnum ${startTime === a && endTime === b ? "bg-ink-900 text-gold-300 border-ink-900" : "bg-white border-ink-200 text-ink-600 hover:border-ink-400"}`}>
                {timeLabel(a)} – {timeLabel(b)}
              </button>
            ))}
          </div>
        </div>
        <label className="block sm:col-span-2">
          <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">Extra note (optional)</span>
          <TInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Because of load-shedding, class will end early." />
        </label>
      </div>
      {err && <p className="text-[12px] font-semibold text-flame-600 mt-3 anim-fade-in">{err}</p>}
      <div className="mt-4">
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2">Message preview (sent to all parents)</span>
        <pre className="whitespace-pre-wrap font-sans text-[12.5px] text-ink-700 bg-ink-50 border border-ink-150 rounded-[10px] p-3.5 leading-relaxed">{preview}</pre>
      </div>
    </Modal>
  );
}

/* re-export for pages */
export { naturalCompare };
export const monthNow = currentPeriod;
export const statsFor = periodStats;
export { fmtMoney };
