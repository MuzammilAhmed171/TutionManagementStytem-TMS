import React, { useEffect, useState } from "react";
import { AppLogo } from "./ui";

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setFade(true);
    }, 1600);

    const timer2 = setTimeout(() => {
      onFinish();
    }, 1900);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-white flex flex-col items-center justify-between py-12 px-6 select-none transition-opacity duration-300 ${
        fade ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex-1" />

      {/* center brand in light theme */}
      <div className="flex flex-col items-center text-center anim-pop">
        <div className="w-22 h-22 sm:w-26 sm:h-26 rounded-3xl bg-gold-50 border border-gold-500/30 flex items-center justify-center shadow-[0_10px_30px_rgba(232,160,32,0.2)] ring-4 ring-gold-100/60 p-4">
          <AppLogo size={58} />
        </div>
        <h1 className="font-display font-extrabold text-[30px] sm:text-[36px] text-ink-950 tracking-tight mt-5">
          Tuition Desk
        </h1>
        <p className="text-[11px] font-bold tracking-[0.26em] text-gold-700 mt-1 uppercase">
          Tuition Management System
        </p>
      </div>

      <div className="flex-1" />

      {/* bottom developer branding */}
      <div className="flex flex-col items-center gap-0.5 anim-fade-up">
        <span className="text-[10.5px] uppercase font-bold tracking-[0.25em] text-ink-400">
          from
        </span>
        <span className="text-[15px] font-extrabold tracking-wider text-ink-900">
          M3H Developers
        </span>
      </div>
    </div>
  );
}
