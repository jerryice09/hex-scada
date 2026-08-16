import React from "react";
import { COLORS, DEFAULT_THRESHOLDS } from "../data/constants";

// label/unit: 표시용, keyName: thresholds 객체의 키 (예: "inTemp")
// draft: 현재 편집 중인 임계값 draft 객체, setDraftThresholds: draft 갱신 함수
export default function ThresholdRow({ label, unit, keyName, draft, setDraftThresholds }) {
  const def = DEFAULT_THRESHOLDS[keyName];
  const cur = draft[keyName];

  const update = (field, val) => {
    const num = val === "" ? "" : Number(val);
    setDraftThresholds((prev) => ({ ...prev, [keyName]: { ...prev[keyName], [field]: num } }));
  };

  return (
    <div className="rounded-md p-3 flex flex-col gap-2" style={{ background: "#f8fafc", border: `1px solid ${COLORS.panelBorder}` }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
          {label} <span className="text-xs font-mono" style={{ color: COLORS.textDim }}>({unit})</span>
        </span>
        {/* 현재 적용 중인 기본값을 회색으로 표시 */}
        <span className="text-[11px] font-mono" style={{ color: "#94a3b8" }}>
          기본값: {def.min} ~ {def.max}
          {unit}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-mono" style={{ color: COLORS.textDim }}>
          하한
        </label>
        <input
          type="number"
          value={cur.min}
          onChange={(e) => update("min", e.target.value)}
          className="w-24 px-2 py-1.5 rounded text-sm font-mono"
          style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorderLit}`, color: COLORS.textPrimary }}
        />
        <label className="text-[11px] font-mono" style={{ color: COLORS.textDim }}>
          상한
        </label>
        <input
          type="number"
          value={cur.max}
          onChange={(e) => update("max", e.target.value)}
          className="w-24 px-2 py-1.5 rounded text-sm font-mono"
          style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorderLit}`, color: COLORS.textPrimary }}
        />
      </div>
    </div>
  );
}
