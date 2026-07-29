import React from "react";
import { COLORS, STATUS_META } from "../data/constants";

// 개별 구간의 상태 레벨(0~3)에 따라 선 색상 + 애니메이션(흐름 속도 또는 점멸)을 결정한다.
function segStyle(level) {
  const color = STATUS_META[level].color;
  if (level === 3) return { stroke: color, style: { animation: "diagramBlink 0.7s ease-in-out infinite" } };
  const duration = level === 0 ? 1.4 : level === 1 ? 2.8 : 4.2;
  return { stroke: color, style: { strokeDasharray: "10 6", animation: `flowDash ${duration}s linear infinite` } };
}

export default function DiagramTab({ paramLevel, dangerCodes }) {
  const inletLevel = Math.max(paramLevel.inTemp, paramLevel.inFlow);
  const tubeLevel = dangerCodes.includes("HEAT_FAULT") ? 3 : Math.max(paramLevel.inTemp, paramLevel.outTemp);
  const outletLevel = paramLevel.outFlow;
  const shellLevel = paramLevel.pressure;
  const flameLevel = paramLevel.flame;

  const sections = [
    { label: "입구 배관 (증기 공급)", level: inletLevel },
    { label: "튜브 번들 (열교환 코어)", level: tubeLevel },
    { label: "출구 배관 (응축수 배출)", level: outletLevel },
    { label: "쉘 냉각수 계통 (압력)", level: shellLevel },
    { label: "화염 감지 구역", level: flameLevel },
  ];

  const inlet = segStyle(inletLevel);
  const tube = segStyle(tubeLevel);
  const outlet = segStyle(outletLevel);
  const shell = segStyle(shellLevel);
  const flameZone = segStyle(flameLevel);

  return (
    <section className="rounded-lg p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: COLORS.textDim }}>
        쉘-튜브형 열교환기 구조도 (실시간 연동)
      </h2>
      <div className="w-full flex justify-center">
        <svg width="100%" viewBox="0 0 700 240" style={{ maxWidth: 720 }}>
          <rect x="150" y="50" width="330" height="80" rx="10" fill="none" stroke={COLORS.panelBorderLit} strokeWidth="2" />
          {[65, 85, 105, 125].map((y, i) => (
            <line key={i} x1="160" y1={y} x2="470" y2={y} stroke={tube.stroke} strokeWidth="3" style={tube.style} />
          ))}
          <line x1="20" y1="90" x2="150" y2="90" stroke={inlet.stroke} strokeWidth="6" style={inlet.style} />
          <text x="35" y="72" fontSize="16">🌡</text>
          <text x="95" y="72" fontSize="16">💧</text>
          <line x1="480" y1="90" x2="620" y2="90" stroke={outlet.stroke} strokeWidth="6" style={outlet.style} />
          <text x="590" y="72" fontSize="16">💧</text>
          <line x1="185" y1="10" x2="185" y2="50" stroke={shell.stroke} strokeWidth="5" style={shell.style} />
          <text x="192" y="24" fontSize="16">🧭</text>
          <line x1="445" y1="130" x2="445" y2="172" stroke={flameZone.stroke} strokeWidth="5" style={flameZone.style} />
          <text x="452" y="165" fontSize="16">🔥</text>
          <text x="345" y="45" textAnchor="middle" fontSize="12" fontFamily="monospace" fill={COLORS.textDim}>
            SHELL
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2 mt-4">
        {sections.map((s) => {
          const meta = STATUS_META[s.level];
          return (
            <div key={s.label} className="text-xs font-mono px-3 py-2 rounded" style={{ background: "#0a1223", border: `1px solid ${COLORS.panelBorder}` }}>
              <div style={{ color: COLORS.textDim }}>{s.label}</div>
              <div className="mt-1 font-semibold" style={{ color: meta.color }}>
                {s.level === 0 ? "정상 ✅" : `${meta.label} ⚠`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
