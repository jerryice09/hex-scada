import React from "react";
import { COLORS, STATUS_META } from "../data/constants";

// 센서 하나의 실시간 값을 보여주는 카드.
// fault가 true면 값 대신 "SENSOR FAULT"를 회색으로 표시하고 레벨 색상은 무시한다.
export default function SensorCard({ icon: Icon, label, value, unit, sub, level, fault }) {
  if (fault) {
    return (
      <div
        className="rounded-lg p-4 flex flex-col gap-2"
        style={{ background: "#141821", border: `1px solid ${COLORS.fault}`, borderLeft: `3px solid ${COLORS.fault}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={15} style={{ color: COLORS.fault }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: "#8a94a6", letterSpacing: "0.08em" }}>
              {label}
            </span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-bold" style={{ color: "#e5e7eb", background: `${COLORS.fault}44` }}>
            FAULT
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-xl font-semibold" style={{ color: "#8a94a6" }}>
            — —
          </span>
        </div>
        <span className="text-[11px] font-mono" style={{ color: "#6b7280" }}>
          SENSOR FAULT · 판단 로직에서 제외됨
        </span>
      </div>
    );
  }

  const meta = STATUS_META[level];
  return (
    <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderLeft: `3px solid ${meta.color}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} style={{ color: COLORS.cyan }} />
          <span className="text-xs uppercase tracking-wider" style={{ color: COLORS.textDim, letterSpacing: "0.08em" }}>
            {label}
          </span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ color: meta.color, background: `${meta.color}1a`, fontSize: "10px" }}>
          {meta.label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-2xl font-semibold tabular-nums" style={{ color: COLORS.textPrimary }}>
          {value}
        </span>
        <span className="text-xs font-mono" style={{ color: COLORS.textDim }}>
          {unit}
        </span>
      </div>
      <span className="text-[11px] font-mono" style={{ color: COLORS.textDim }}>
        {sub}
      </span>
    </div>
  );
}
