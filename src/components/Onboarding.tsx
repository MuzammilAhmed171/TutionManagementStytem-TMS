import React, { useState } from "react";
import { AppLogo, Btn, Icon } from "./ui";

const CARDS = [
  {
    icon: "students",
    badge: "Smart Admission & Ledger",
    title: "One Register, All Classes",
    description:
      "Manage Nursery to College students in one centralized digital ledger. Set custom fee due days, subjects, and maintain parent WhatsApp contacts with ease.",
    iconBg: "bg-gold-500 text-ink-950",
    badgeColor: "text-gold-800 bg-gold-100 border-gold-300",
  },
  {
    icon: "attendance",
    badge: "1-Tap Attendance",
    title: "Instant Attendance & Alerts",
    description:
      "Mark daily attendance in one tap with automatic holiday protection. Send instant WhatsApp notifications to absent students' parents with zero extra effort.",
    iconBg: "bg-[#128c5e] text-white",
    badgeColor: "text-mint-800 bg-mint-100 border-mint-300",
  },
  {
    icon: "fees",
    badge: "Automated Fees & Receipts",
    title: "Fee Challans & WhatsApp Slips",
    description:
      "Automatic monthly fee challans on the 1st of every month. Generate multi-month receipts and share image slips directly to WhatsApp without paper clutter.",
    iconBg: "bg-ink-900 text-gold-400",
    badgeColor: "text-ink-800 bg-ink-100 border-ink-300",
  },
];

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [idx, setIdx] = useState(0);

  const card = CARDS[idx];
  const isLast = idx === CARDS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onFinish();
    } else {
      setIdx((i) => i + 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-ledger text-ink-950 flex flex-col px-6 pt-[calc(max(env(safe-area-inset-top,0px),8px)+12px)] pb-4 select-none overflow-hidden">
      {/* top navbar with logo & skip button */}
      <div className="flex items-center justify-between w-full max-w-5xl mx-auto z-10">
        <div className="flex items-center gap-2.5">
          <AppLogo size={32} />
          <span className="font-display font-bold text-[17px] text-ink-900 tracking-tight">Tuition Desk</span>
        </div>
        <button
          onClick={onFinish}
          className="text-[13px] font-bold text-ink-500 hover:text-ink-900 px-3.5 py-1.5 rounded-full bg-white border border-ink-200 hover:border-ink-300 shadow-sm transition-colors press"
        >
          Skip
        </button>
      </div>

      {/* main full-screen light card area */}
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-center py-4 sm:py-6">
        <div
          key={idx}
          className="w-full min-h-[45vh] rounded-3xl bg-white border border-ink-150 p-7 sm:p-10 lg:p-16 flex flex-col items-center text-center shadow-[0_12px_40px_rgba(14,24,48,0.08)] anim-pop"
        >
          {/* big icon */}
          <div className={`w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-3xl ${card.iconBg} flex items-center justify-center shadow-lg mb-6 sm:mb-8 lg:mb-10 ring-4 ring-ink-50`}>
            <Icon name={card.icon} size={48} strokeWidth={2.1} />
          </div>

          <span className={`inline-block text-[11px] sm:text-[12px] lg:text-[13px] font-extrabold uppercase tracking-[0.15em] ${card.badgeColor} border rounded-full px-4 py-1.5 mb-4 shadow-sm`}>
            {card.badge}
          </span>

          <h2 className="font-display font-extrabold text-[28px] sm:text-[34px] lg:text-[42px] leading-[1.12] text-ink-950 tracking-tight">
            {card.title}
          </h2>

          <p className="text-[14.5px] sm:text-[16px] lg:text-[18px] text-ink-600 leading-relaxed mt-4 max-w-2xl font-normal">
            {card.description}
          </p>
        </div>

        {/* page progress indicators */}
        <div className="flex items-center justify-center gap-2.5 mt-4">
          {CARDS.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === idx ? "w-10 bg-gold-500 shadow-md shadow-gold-500/30" : "w-2.5 bg-ink-200 hover:bg-ink-300"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* bottom navigation buttons */}
      <div className="w-full max-w-5xl mx-auto z-10">
        <div className="flex items-center gap-3 w-full [&>*]:flex-1">
          {idx > 0 && (
            <button
              onClick={() => setIdx((i) => i - 1)}
              className="h-12 rounded-xl bg-white hover:bg-ink-50 text-ink-700 font-bold text-[14px] transition-all press border border-ink-200 shadow-sm"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="h-12 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink-950 font-extrabold text-[15px] transition-all shadow-[0_4px_20px_rgba(232,160,32,0.4)] press flex items-center justify-center gap-2 border border-gold-600/30"
          >
            <span>{isLast ? "Get Started" : "Next"}</span>
            <Icon name={isLast ? "check" : "arrowR"} size={16} strokeWidth={2.8} />
          </button>
        </div>
      </div>
    </div>
  );
}
