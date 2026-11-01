import React from "react";
import { COLORS, STATUS_META } from "../data/constants";

// 센서 하나의 실시간 값을 보여주는 카드.
// fault가 true면 값 대신 "SENSOR FAULT"를 회색으로 표시하고 레벨 색상은 무시한다.
// statusLabel/faultNote: 다국어 지원을 위해 호출측(MonitorTab)에서 t()로 번역해 전달한다.
// large: "크게 보기" 모드. 현장 모니터를 몇 걸음 떨어져서 봐도 숫자가 읽히도록
//        값·단위·라벨·상태 배지를 모두 키우고, 정상이 아닐 때는 숫자 자체를 상태 색으로 칠한다.
export default function SensorCard({ icon: Icon, label, value, unit, sub, level, fault, statusLabel, faultNote, large = false }) {
  // 기본/크게 보기 두 가지 크기를 한곳에서 정의해 두면 아래 마크업이 단순해진다.
  const size = large
    ? { pad: "p-5", gap: "gap-3", icon: 22, label: "text-base", badge: "text-sm px-2.5 py-1", value: "text-6xl", unit: "text-xl", sub: "text-sm", accent: "5px" }
    : { pad: "p-4", gap: "gap-2", icon: 15, label: "text-xs", badge: "text-[10px] px-1.5 py-0.5", value: "text-2xl", unit: "text-xs", sub: "text-[11px]", accent: "3px" };

  if (fault) {
    return (
      <div
        className={`rounded-lg ${size.pad} flex flex-col ${size.gap}`}
        style={{ background: COLORS.panelMuted, border: `1px solid ${COLORS.fault}`, borderLeft: `${size.accent} solid ${COLORS.fault}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={size.icon} style={{ color: COLORS.fault }} />
            <span className={`${size.label} uppercase tracking-wider`} style={{ color: COLORS.textMid, letterSpacing: "0.08em" }}>
              {label}
            </span>
          </div>
          <span className={`${size.badge} rounded uppercase tracking-wide font-bold`} style={{ color: COLORS.textMid, background: `${COLORS.fault}33` }}>
            FAULT
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`font-mono ${large ? "text-5xl" : "text-xl"} font-semibold`} style={{ color: COLORS.textMid }}>
            — —
          </span>
        </div>
        <span className={`${size.sub} font-mono`} style={{ color: COLORS.textDim }}>
          SENSOR FAULT · {faultNote}
        </span>
      </div>
    );
  }

  const meta = STATUS_META[level];
  // 크게 보기에서 정상이 아니면 숫자를 상태 색(노랑/주황/빨강)으로 칠해, 멀리서도 어느 값이 문제인지 바로 보이게 한다.
  const valueColor = large && level > 0 ? meta.color : COLORS.textPrimary;
  return (
    <div
      className={`rounded-lg ${size.pad} flex flex-col ${size.gap}`}
      style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderLeft: `${size.accent} solid ${meta.color}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={size.icon} style={{ color: COLORS.cyan, flexShrink: 0 }} />
          <span className={`${size.label} uppercase tracking-wider truncate`} style={{ color: COLORS.textDim, letterSpacing: "0.08em" }}>
            {label}
          </span>
        </div>
        <span className={`${size.badge} rounded uppercase tracking-wide font-semibold shrink-0`} style={{ color: meta.color, background: `${meta.color}1a` }}>
          {statusLabel}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono ${size.value} ${large ? "font-bold leading-none" : "font-semibold"} tabular-nums`} style={{ color: valueColor }}>
          {value}
        </span>
        <span className={`${size.unit} font-mono`} style={{ color: COLORS.textDim }}>
          {unit}
        </span>
      </div>
      <span className={`${size.sub} font-mono`} style={{ color: COLORS.textDim }}>
        {sub}
      </span>
    </div>
  );
}
