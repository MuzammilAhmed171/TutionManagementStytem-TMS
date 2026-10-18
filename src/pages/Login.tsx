import React, { useState } from "react";
import { useStore, withActivity } from "../lib/store";
import { AppLogo, Btn, Icon, Modal, Switch, TInput, TutorAvatar, useToast } from "../components/ui";

const FEATURES = [
  { icon: "students", text: "One admission form — classes stack themselves" },
  { icon: "attendance", text: "One-tap attendance with holiday protection" },
  { icon: "fees", text: "Monthly challans + instant payment receipts" },
  { icon: "whatsapp", text: "Slips, receipts & timing notices via WhatsApp" },
];

export default function Login({ onFirstRun, onSkip }: { onFirstRun?: () => void; onSkip?: () => void }) {
  const toast = useToast();
  const { state, login, patch } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askDemo, setAskDemo] = useState(false);

  /* forgot password state */
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [answerInput, setAnswerInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [forgotErr, setForgotErr] = useState("");

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setTimeout(() => {
      const ok = login(username, password, remember);
      if (!ok) {
        setError(true);
        setBusy(false);
        setTimeout(() => setError(false), 500);
      }
    }, 350);
  };

  const demo = () => {
    setUsername("tutor");
    setPassword("tutor123");
    setBusy(true);
    setTimeout(() => login("tutor", "tutor123", remember), 300);
  };

  const openForgot = () => {
    setForgotOpen(true);
    setForgotStep(1);
    setAnswerInput("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotErr("");
  };

  const verifyAnswer = (e?: React.FormEvent) => {
    e?.preventDefault();
    const correct = (state.settings.securityAnswer || "Math").trim().toLowerCase();
    if (!answerInput.trim()) {
      setForgotErr("Please enter the security answer.");
      return;
    }
    if (answerInput.trim().toLowerCase() !== correct) {
      setForgotErr("Incorrect security answer. Please check and try again.");
      return;
    }
    setForgotErr("");
    setForgotStep(2);
  };

  const handleResetPassword = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newPassword.trim()) {
      setForgotErr("Please enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotErr("Passwords do not match.");
      return;
    }
    const nextSettings = { ...state.settings, password: newPassword };
    patch({
      settings: nextSettings,
      activity: withActivity({ ...state, settings: nextSettings }, "Password reset via security question.", "settings"),
    });
    toast.push("Password reset successfully! Logged in.", "ok");
    setPassword(newPassword);
    setForgotOpen(false);
    login(state.settings.username, newPassword, remember);
  };

  /* register / setup state */
  const [mode, setMode] = useState<"login" | "register" | "first-choice">(onFirstRun ? "first-choice" : "login");
  const [regTuition, setRegTuition] = useState("Bright Stars Tuition");
  const [regTutor, setRegTutor] = useState("Miss Ayesha Khan");
  const [regUser, setRegUser] = useState("tutor");
  const [regPass, setRegPass] = useState("tutor123");
  const [regShowPass, setRegShowPass] = useState(false);
  const [regQuestion, setRegQuestion] = useState("What is your favorite subject?");
  const [regAnswer, setRegAnswer] = useState("Math");
  const [regPhone, setRegPhone] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regErr, setRegErr] = useState("");

  const handleRegister = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!regTuition.trim()) { setRegErr("Please enter your Tuition Name."); return; }
    if (!regTutor.trim()) { setRegErr("Please enter Tutor Name."); return; }
    if (!regUser.trim()) { setRegErr("Please enter a username."); return; }
    if (!regPass) { setRegErr("Please enter a password."); return; }
    if (!regAnswer.trim()) { setRegErr("Please enter the secret recovery answer."); return; }

    const nextSettings = {
      ...state.settings,
      tuitionName: regTuition.trim(),
      tutorName: regTutor.trim(),
      username: regUser.trim(),
      password: regPass,
      securityQuestion: regQuestion,
      securityAnswer: regAnswer.trim(),
      phone: regPhone.trim(),
      address: regAddress.trim(),
    };

    patch({
      settings: nextSettings,
      activity: withActivity({ ...state, settings: nextSettings }, `Account initialized for ${regTuition.trim()} (${regTutor.trim()}).`, "settings"),
    });

    toast.push("Account created successfully! Welcome to Tuition Desk.", "ok");
    login(regUser.trim(), regPass, remember);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* ---------- brand ledger panel (visible on desktop only) ---------- */}
      <div className="hidden lg:flex bg-inkweave relative overflow-hidden flex-col justify-between px-8 sm:px-14 py-10 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-ink-800">
        <div className="pointer-events-none absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full border-[28px] border-gold-500/10" />
        <div className="pointer-events-none absolute -right-10 top-40 w-40 h-40 rounded-full border-[14px] border-mint-500/10" />

        <div className="flex items-center gap-3 anim-fade-up">
          <AppLogo size={42} />
          <div>
            <div className="font-display font-bold text-[19px] text-white leading-none">Tuition Desk</div>
            <div className="text-[10px] font-bold tracking-[0.28em] text-gold-400 mt-1">TUITION MANAGEMENT SYSTEM</div>
          </div>
        </div>

        <div className="max-w-lg py-10 lg:py-0">
          <p className="text-[11px] font-bold tracking-[0.3em] text-gold-400 anim-fade-up" style={{ animationDelay: "80ms" }}>SINGLE-TUTOR · ONE TIMING · LOCAL-FIRST</p>
          <h1 className="font-display font-extrabold text-[34px] sm:text-[46px] leading-[1.06] text-white mt-4 anim-fade-up" style={{ animationDelay: "140ms" }}>
            The register, the receipts & the reminders — <span className="text-gold-400">one ledger.</span>
          </h1>
          <p className="text-[14px] text-ink-300 leading-relaxed mt-5 max-w-md anim-fade-up" style={{ animationDelay: "200ms" }}>
            Attendance, monthly fee challans, payment receipts and WhatsApp notices for every class from Nursery to First Year. Data never leaves this browser.
          </p>
          <ul className="mt-8 space-y-3 stagger">
            {FEATURES.map((f) => (
              <li key={f.icon} className="flex items-center gap-3 text-[13px] text-ink-200 font-medium">
                <span className="w-8 h-8 rounded-[9px] bg-ink-800 border border-ink-700 text-gold-400 flex items-center justify-center shrink-0"><Icon name={f.icon} size={15} /></span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-ink-500 anim-fade-up" style={{ animationDelay: "280ms" }}>
        </p>
      </div>

      {/* ---------- challan-style login / registration ---------- */}
      <div className="bg-ledger flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className={`w-full max-w-[420px] anim-pop ${error ? "anim-shake" : ""}`}>
          {mode === "first-choice" ? (
            <div className="card overflow-hidden shadow-xl">
              <div className="bg-ink-900 px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-[16px] text-white">Welcome to Tuition Desk</div>
                  <div className="text-[10px] font-bold tracking-[0.24em] text-gold-400 mt-0.5">GET STARTED</div>
                </div>
                <AppLogo size={32} />
              </div>
              <div className="p-5 sm:p-6 space-y-3">
                <button
                  onClick={() => setMode("register")}
                  className="w-full text-left rounded-[12px] border border-gold-600/40 bg-gold-50/80 hover:bg-gold-100 transition-colors p-4 press"
                >
                  <span className="flex items-center gap-2 text-[14px] font-bold text-ink-900">
                    <Icon name="user" size={17} className="text-gold-700" /> Create Tuition Account
                  </span>
                  <span className="block text-[12px] text-ink-600 mt-1 leading-relaxed">
                    Set up your own tuition name, tutor credentials, secret recovery question and optional details.
                  </span>
                </button>

                <button
                  onClick={() => { onFirstRun?.(); }}
                  className="w-full text-left rounded-[12px] border border-ink-200 bg-white hover:border-ink-400 transition-colors p-4 press"
                >
                  <span className="flex items-center gap-2 text-[14px] font-bold text-ink-900">
                    <Icon name="refresh" size={17} className="text-ink-600" /> Explore with Demo Data
                  </span>
                  <span className="block text-[12px] text-ink-500 mt-1 leading-relaxed">
                    Loads 12 sample students, monthly challans, receipts, and demo login (tutor / tutor123).
                  </span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    onClick={() => setMode("login")}
                    className="text-[12.5px] font-bold text-gold-700 hover:text-gold-800 underline"
                  >
                    Already have an account? Sign In
                  </button>
                </div>
              </div>
            </div>
          ) : mode === "register" ? (
            <form onSubmit={handleRegister} className="card overflow-hidden shadow-xl">
              <div className="bg-ink-900 px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-[15px] text-white">Create Tuition Account</div>
                  <div className="text-[10px] font-bold tracking-[0.24em] text-gold-400 mt-0.5">INITIAL SETUP</div>
                </div>
                <AppLogo size={32} />
              </div>

              <div className="px-5 sm:px-6 py-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1">
                    Tuition Name <span className="text-flame-600">*</span>
                  </span>
                  <input
                    value={regTuition}
                    onChange={(e) => { setRegTuition(e.target.value); setRegErr(""); }}
                    placeholder="e.g. Bright Stars Tuition"
                    className="w-full h-10 px-3 rounded-[9px] border border-ink-200 bg-white text-[13.5px] focus:border-gold-500"
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1">
                    Tutor Name <span className="text-flame-600">*</span>
                  </span>
                  <input
                    value={regTutor}
                    onChange={(e) => { setRegTutor(e.target.value); setRegErr(""); }}
                    placeholder="e.g. Miss Ayesha Khan"
                    className="w-full h-10 px-3 rounded-[9px] border border-ink-200 bg-white text-[13.5px] focus:border-gold-500"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1">
                      Username <span className="text-flame-600">*</span>
                    </span>
                    <input
                      value={regUser}
                      onChange={(e) => { setRegUser(e.target.value); setRegErr(""); }}
                      placeholder="tutor"
                      className="w-full h-10 px-3 rounded-[9px] border border-ink-200 bg-white text-[13.5px] focus:border-gold-500"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1">
                      Password <span className="text-flame-600">*</span>
                    </span>
                    <div className="relative">
                      <input
                        type={regShowPass ? "text" : "password"}
                        value={regPass}
                        onChange={(e) => { setRegPass(e.target.value); setRegErr(""); }}
                        placeholder="••••••••"
                        className="w-full h-10 px-3 pr-9 rounded-[9px] border border-ink-200 bg-white text-[13.5px] focus:border-gold-500"
                      />
                      <button
                        type="button"
                        onClick={() => setRegShowPass(!regShowPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-800"
                      >
                        <Icon name={regShowPass ? "eyeoff" : "eye"} size={15} />
                      </button>
                    </div>
                  </label>
                </div>

                <div className="p-3 rounded-[10px] bg-ink-50 border border-ink-150 space-y-2.5">
                  <span className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-500">
                    Forgot Password Recovery
                  </span>
                  <label className="block">
                    <span className="block text-[10.5px] font-semibold text-ink-400 mb-1">Security Question</span>
                    <select
                      value={regQuestion}
                      onChange={(e) => setRegQuestion(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-[8px] border border-ink-200 bg-white text-[12.5px] focus:border-gold-500"
                    >
                      <option value="What is your favorite subject?">What is your favorite subject?</option>
                      <option value="What is your pet's name?">What is your pet's name?</option>
                      <option value="What was your childhood school name?">What was your childhood school name?</option>
                      <option value="What is your birthplace / hometown?">What is your birthplace / hometown?</option>
                      <option value="What is your favorite teacher's name?">What is your favorite teacher's name?</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[10.5px] font-semibold text-ink-400 mb-1">
                      Secret Answer <span className="text-flame-600">*</span>
                    </span>
                    <input
                      value={regAnswer}
                      onChange={(e) => { setRegAnswer(e.target.value); setRegErr(""); }}
                      placeholder="e.g. Math"
                      className="w-full h-9 px-2.5 rounded-[8px] border border-ink-200 bg-white text-[12.5px] focus:border-gold-500"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1">Phone (Optional)</span>
                    <input
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="0300-1234567"
                      className="w-full h-10 px-3 rounded-[9px] border border-ink-200 bg-white text-[13px] focus:border-gold-500"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1">Address (Optional)</span>
                    <input
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="Rawalpindi"
                      className="w-full h-10 px-3 rounded-[9px] border border-ink-200 bg-white text-[13px] focus:border-gold-500"
                    />
                  </label>
                </div>

                {regErr && (
                  <p className="text-[12px] font-semibold text-flame-700 bg-flame-50 border border-flame-100 rounded-[8px] px-3 py-2 anim-fade-in">
                    {regErr}
                  </p>
                )}

                <div className="pt-2 flex flex-col gap-2">
                  <Btn type="submit" variant="gold" size="lg" className="w-full" icon="check">
                    Create & Start Tuition
                  </Btn>
                  <button
                    type="button"
                    onClick={() => setMode("first-choice")}
                    className="text-[12px] font-semibold text-ink-500 hover:text-ink-800 py-1"
                  >
                    ← Back to Options
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={submit} className="card overflow-hidden">
              {/* challan header strip */}
              <div className="bg-ink-900 px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-[15px] text-white">{state.settings.tuitionName}</div>
                  <div className="text-[10px] font-bold tracking-[0.24em] text-gold-400 mt-0.5">SESSION CHALLAN · OWNER LOGIN</div>
                </div>
                <TutorAvatar size={36} photo={state.settings.tutorPhoto} />
              </div>

              <div className="px-6 py-6">
                <label className="block mb-4">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-1.5">Username</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="tutor"
                    className="w-full h-10.5 px-3.5 rounded-[9px] border border-ink-200 bg-white text-[14px] focus:border-gold-500 hover:border-ink-300 placeholder:text-ink-300"
                  />
                </label>
                <label className="block mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500">Password</span>
                    <button
                      type="button"
                      onClick={openForgot}
                      className="text-[11.5px] font-semibold text-gold-600 hover:text-gold-700 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full h-10.5 px-3.5 pr-11 rounded-[9px] border border-ink-200 bg-white text-[14px] focus:border-gold-500 hover:border-ink-300 placeholder:text-ink-300"
                    />
                    <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-800">
                      <Icon name={show ? "eyeoff" : "eye"} size={17} />
                    </button>
                  </div>
                </label>

                <div className="flex items-center justify-between mb-5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <Switch checked={remember} onChange={setRemember} label="Remember session" />
                    <span className="text-[12.5px] font-semibold text-ink-600">Remember on this device</span>
                  </label>
                </div>

                {error && (
                  <p className="mb-4 text-[12.5px] font-semibold text-flame-700 bg-flame-50 border border-flame-100 rounded-[8px] px-3 py-2.5 anim-fade-in">
                    Username or password does not match the saved credentials.
                  </p>
                )}

                <Btn type="submit" variant="gold" size="lg" className="w-full" disabled={busy} icon={busy ? "refresh" : "logout"}>
                  {busy ? "Checking…" : "Open the Ledger"}
                </Btn>

                <div className="mt-4 flex items-center justify-between text-[12px] font-bold text-gold-700">
                  <button type="button" onClick={() => setMode("register")} className="hover:underline">Create Account</button>
                  <button type="button" onClick={demo} className="hover:underline">Use Demo Login</button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Forgot Password"
        sub={forgotStep === 1 ? "Verify your security answer to reset password" : "Set your new password"}
      >
        {forgotStep === 1 ? (
          <form onSubmit={verifyAnswer} className="space-y-4">
            <div className="rounded-[10px] bg-ink-50 border border-ink-150 p-3.5">
              <span className="block text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400 mb-1">Security Question</span>
              <p className="text-[13.5px] font-bold text-ink-900">{state.settings.securityQuestion || "What is your favorite subject?"}</p>
            </div>

            <label className="block">
              <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">
                Your Answer <span className="text-flame-600">*</span>
              </span>
              <TInput
                autoFocus
                value={answerInput}
                onChange={(e) => { setAnswerInput(e.target.value); setForgotErr(""); }}
                placeholder="Enter the secret answer"
              />
            </label>

            {forgotErr && (
              <p className="text-[12px] font-semibold text-flame-600 bg-flame-50 border border-flame-100 rounded-[8px] px-3 py-2 anim-fade-in">
                {forgotErr}
              </p>
            )}

            <div className="flex flex-col gap-2.5 pt-2 sm:flex-row sm:justify-end">
              <Btn type="button" variant="outline" onClick={() => setForgotOpen(false)}>Cancel</Btn>
              <Btn type="submit" variant="gold" icon="check">Verify Answer</Btn>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="flex items-center gap-2 text-mint-700 bg-mint-50 border border-mint-600/25 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold anim-tick">
              <Icon name="check" size={15} strokeWidth={2.4} /> Security answer verified successfully!
            </div>

            <label className="block">
              <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">
                New Password <span className="text-flame-600">*</span>
              </span>
              <div className="relative">
                <TInput
                  type={showNewPw ? "text" : "password"}
                  autoFocus
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setForgotErr(""); }}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-800"
                  aria-label="Toggle password visibility"
                >
                  <Icon name={showNewPw ? "eyeoff" : "eye"} size={16} />
                </button>
              </div>
            </label>

            <label className="block">
              <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500 mb-1.5">
                Confirm New Password <span className="text-flame-600">*</span>
              </span>
              <TInput
                type={showNewPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setForgotErr(""); }}
                placeholder="Re-enter new password"
              />
            </label>

            {forgotErr && (
              <p className="text-[12px] font-semibold text-flame-600 bg-flame-50 border border-flame-100 rounded-[8px] px-3 py-2 anim-fade-in">
                {forgotErr}
              </p>
            )}

            <div className="flex flex-col gap-2.5 pt-2 sm:flex-row sm:justify-end">
              <Btn type="button" variant="outline" onClick={() => setForgotOpen(false)}>Cancel</Btn>
              <Btn type="submit" variant="gold" icon="save">Save & Update Password</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
