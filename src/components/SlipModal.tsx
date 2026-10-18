import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore, withActivity } from "../lib/store";
import { Btn, Icon, Modal, useToast } from "./ui";
import { buildChallanModel, buildReceiptModel, renderSlip } from "../lib/slip";
import { challanMessage, receiptMessage } from "../lib/notify";
import { dataUrlToBlob, downloadImage, isMobileDevice, openWhatsApp, shareNativeOrWhatsApp, uid } from "../lib/utils";
import type { FeeSlipLog, Guardian } from "../types";

export type SlipTarget =
  | { kind: "challan"; recordId: string }
  | { kind: "receipt"; paymentId: string };

const navShare = (typeof navigator !== "undefined" ? navigator : {}) as Navigator & { canShare?: (d: ShareData) => boolean };

/**
 * Slip / receipt sharing hub. On mobile it uses the native share sheet so the
 * image is ATTACHED together with the message straight into WhatsApp.
 * Opening WhatsApp (or completing a share) automatically marks the document
 * as sent — no extra taps needed.
 */
export default function SlipModal({ target, onClose }: { target: SlipTarget | null; onClose: () => void }) {
  const { state, patch } = useStore();
  const toast = useToast();
  const [image, setImage] = useState("");
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const loggedRef = useRef(false);

  const targetKey = target ? (target.kind === "challan" ? `c_${target.recordId}` : `r_${target.paymentId}`) : "";

  const { model, waGuards, chalRec, payRec } = useMemo<{
    model: ReturnType<typeof buildChallanModel> | ReturnType<typeof buildReceiptModel> | null;
    waGuards: Guardian[];
    chalRec: typeof state.feeRecords[0] | null;
    payRec: typeof state.payments[0] | null;
  }>(() => {
    if (!target) return { model: null, waGuards: [], chalRec: null, payRec: null };
    if (target.kind === "challan") {
      const rec = (state.feeRecords ?? []).find((r) => r.id === target.recordId);
      if (!rec) return { model: null, waGuards: [], chalRec: null, payRec: null };
      const m = buildChallanModel(state, rec);
      const guards = (state.guardians ?? []).filter((g) => g.studentId === rec.studentId && g.whatsapp && g.phone.trim());
      return { model: m, waGuards: guards, chalRec: rec, payRec: null };
    }
    const pay = (state.payments ?? []).find((p) => p.id === target.paymentId);
    if (!pay) return { model: null, waGuards: [], chalRec: null, payRec: null };
    const m = buildReceiptModel(state, pay);
    const guards = (state.guardians ?? []).filter((g) => g.studentId === pay.studentId && g.whatsapp && g.phone.trim());
    return { model: m, waGuards: guards, chalRec: null, payRec: pay };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, state]);

  useEffect(() => {
    loggedRef.current = false;
    setImage("");
    if (!target || !model) return;
    const t1 = setTimeout(() => {
      const dataUrl = renderSlip(model);
      setImage(dataUrl);
    }, 10);
    const msgText = model
      ? (model.kind === "challan"
          ? challanMessage(state, model)
          : payRec
          ? receiptMessage(state, payRec)
          : "")
      : "";
    const t2 = setTimeout(() => {
      setMsg(msgText);
    }, 20);
    const prim = waGuards.filter((g) => g.primary);
    setSel((prim.length ? prim : waGuards.slice(0, 1)).map((g) => g.id));
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  if (!target || !model) return null;

  const isChallan = model.kind === "challan";
  const no = isChallan ? model.slipNo : model.receiptNo;
  const label = isChallan ? "Challan" : "Receipt";
  const fileName = `${no}-${model.studentName.replace(/\s+/g, "-")}.png`;
  const selected = waGuards.filter((g) => sel.includes(g.id));
  const file = image ? new File([dataUrlToBlob(image)], fileName, { type: "image/png" }) : null;
  const canAttach = isMobileDevice() || (!!file && typeof navigator !== "undefined" && typeof navigator.share === "function" && !!navShare.canShare && navShare.canShare({ files: [file] }));

  const markSent = (phones: string[]) => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    const refId = isChallan ? (target as { recordId: string }).recordId : (target as { paymentId: string }).paymentId;
    const log: FeeSlipLog = { id: uid("slp"), kind: model.kind, refId, no, generatedAt: new Date().toISOString(), sentTo: phones, sent: true };
    const next = { ...state, slips: [...state.slips, log] };
    patch({ slips: next.slips, activity: withActivity(next, `${label} ${no} shared on WhatsApp for ${model.studentName} (${phones.length} number${phones.length === 1 ? "" : "s"}).`, "share") });
    toast.push(`${label} ${no} marked as sent ✓`);
  };

  /* primary mobile flow — image + message attach together via native share sheet */
  const shareAttached = async () => {
    if (!image) { toast.push("Image is still generating — one second…", "warn"); return; }
    const ok = await shareNativeOrWhatsApp({
      title: `${label} ${no} - ${model.studentName}`,
      text: msg,
      file,
      dataUrl: image,
      phone: selected[0]?.phone,
    });
    if (ok) {
      markSent(selected.length ? selected.map((g) => g.phone) : ["native-share"]);
    }
  };

  /* per-guardian flow — sends text chat message directly */
  const sendChatTo = (gid: string, phone: string) => {
    setSel((s) => (s.includes(gid) ? s : [...s, gid]));
    openWhatsApp(phone, msg);
    markSent([phone]);
    toast.push(`WhatsApp chat opened for contact`);
  };

  return (
    <Modal open onClose={onClose} wide title={isChallan ? "Send Fee Challan" : "Send Payment Receipt"} sub={`${no} · ${model.studentName}`}>
      <div className="grid md:grid-cols-[1fr_290px] gap-5">
        {/* preview */}
        <div>
          <div className="rounded-[12px] border border-ink-150 bg-ink-50 p-2">
            {image ? (
              <img src={image} alt={`${label} preview`} className="w-full h-auto rounded-[8px] shadow-md anim-fade-in" />
            ) : (
              <div className="h-72 flex items-center justify-center text-[12.5px] text-ink-400 font-semibold">
                <span className="flex items-center gap-2"><Icon name="refresh" size={15} className="pulse-dot" /> Generating {label.toLowerCase()}…</span>
              </div>
            )}
          </div>
          {loggedRef.current && (
            <div className="mt-2.5">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-mint-700 bg-mint-50 border border-mint-600/25 rounded-[8px] px-2.5 py-1.5 anim-tick">
                <Icon name="check" size={14} /> Sent — saved to history
              </span>
            </div>
          )}
        </div>

        {/* compose + send */}
        <div className="space-y-4">
          {canAttach ? (
            <button onClick={shareAttached} disabled={!image}
              className="w-full rounded-[12px] bg-[#128c5e] hover:bg-[#0e7a50] disabled:opacity-40 text-white px-4 py-3.5 text-left transition-all press anim-fade-in">
              <span className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-[10px] bg-white/15 flex items-center justify-center shrink-0"><Icon name="whatsapp" size={19} /></span>
                <span>
                  <span className="block text-[14px] font-bold">Share Slip on WhatsApp</span>
                  <span className="block text-[11px] text-white/80 mt-0.5">Image slip & details attached together</span>
                </span>
              </span>
            </button>
          ) : (
            <div className="rounded-[10px] border border-ink-150 bg-ink-50/70 px-3 py-2.5 text-[11.5px] text-ink-500 leading-relaxed">
              Open chat with parent to send message and slip details.
            </div>
          )}

          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-2">Send to ({waGuards.length})</span>
            {waGuards.length === 0 ? (
              <p className="text-[12.5px] text-flame-600 font-semibold bg-flame-50 border border-flame-100 rounded-[9px] px-3 py-2.5">
                No WhatsApp numbers saved for this student. Add a guardian contact first.
              </p>
            ) : (
              <div className="space-y-2">
                {waGuards.map((g) => {
                  const on = sel.includes(g.id);
                  return (
                    <label key={g.id} className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 cursor-pointer transition-colors ${on ? "border-mint-600/40 bg-mint-50/60" : "border-ink-150 hover:border-ink-300"}`}>
                      <input type="checkbox" checked={on} onChange={() => setSel((s) => (on ? s.filter((x) => x !== g.id) : [...s, g.id]))} className="accent-[#12855f]" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-ink-900 truncate">{g.name} <span className="text-ink-400 font-normal">· {g.relation}</span></span>
                        <span className="block font-mono text-[11px] text-ink-400 tnum">{g.phone}</span>
                      </span>
                      <button type="button" onClick={(e) => { e.preventDefault(); sendChatTo(g.id, g.phone); }}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#128c5e] text-white text-[11.5px] font-bold press shrink-0">
                        <Icon name="whatsapp" size={13} /> Chat
                      </button>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 mb-2">Message (editable)</span>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={6}
              className="w-full px-3 py-2.5 rounded-[10px] border border-ink-200 bg-white text-[12px] leading-relaxed focus:border-gold-500" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
