import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { COLORS, SOP_STEPS } from "../data/constants";

// incident: 현재 대응해야 하는 사고 1건 (없으면 아무것도 렌더링하지 않음)
// onConfirm: [확인 — 조치 완료] 클릭 시 호출. 호출측(App.jsx)에서 incident.resolved/acknowledged 처리를 담당한다.
export default function SopModal({ incident, onConfirm }) {
  if (!incident) return null;
  const sop = SOP_STEPS[incident.code] || { title: "비상 대응 SOP", steps: [] };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(2,6,16,0.78)", animation: "tabFadeIn 0.2s ease" }}>
      <div className="w-full max-w-md rounded-xl p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.danger}66`, boxShadow: "0 0 40px rgba(239,68,68,0.35)" }}>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={20} style={{ color: COLORS.danger }} />
          <h3 className="text-base font-bold" style={{ color: COLORS.danger }}>
            {sop.title}
          </h3>
        </div>
        <p className="text-xs font-mono mb-4" style={{ color: COLORS.textDim }}>
          {incident.text}
        </p>
        <ol className="flex flex-col gap-2 mb-5">
          {sop.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: COLORS.textPrimary }}>
              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold font-mono" style={{ background: `${COLORS.danger}22`, color: COLORS.danger }}>
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <button onClick={onConfirm} className="w-full py-2.5 rounded-md font-semibold text-sm flex items-center justify-center gap-2" style={{ background: COLORS.danger, color: "#1a0505" }}>
          <CheckCircle2 size={16} /> 확인 — 조치 완료
        </button>
      </div>
    </div>
  );
}
