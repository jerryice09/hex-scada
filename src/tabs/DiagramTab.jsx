import React from "react";
import { COLORS, STATUS_META } from "../data/constants";
import HeatExchanger3D, { PIN_LABELS } from "../components/HeatExchanger3D";

// 문제점 개선: 기존에는 추상화된 SVG 배관도라서 실제 밸브 위치를 알기 어려웠다.
// 학생이 OpenSCAD로 실측 규격(전장 555mm, 쉘 외경 114mm 등)에 맞춰 직접 3D 모델링한
// 열교환기(입구/출구/벤트/드레인 각인 포함)를 그대로 불러와서, 신입 사원도 실물과
// 동일한 형태로 각 포트 위치를 익힐 수 있게 했다.
export default function DiagramTab({ paramLevel, dangerCodes }) {
  // 3D 뷰의 5개 핀(IN/OUT/VENT/DRAIN/화염구역)에 매핑되는 실시간 상태 레벨.
  // 열교환 이상(HEAT_FAULT)이 감지되면 입구·출구 핀을 모두 위험으로 강조한다.
  const heatFault = dangerCodes.includes("HEAT_FAULT");
  const levels = {
    in: Math.max(paramLevel.inTemp, paramLevel.inFlow, heatFault ? 3 : 0),
    out: Math.max(paramLevel.outTemp, heatFault ? 3 : 0),
    vent: paramLevel.pressure,
    drain: paramLevel.outFlow,
    flame: paramLevel.flame,
  };

  const sections = [
    { key: "in", desc: "고온 유체 유입 지점 — 온도·유량 이상 시 강조" },
    { key: "out", desc: "유체 배출 지점 — 출구 온도 이상 시 강조" },
    { key: "vent", desc: "기체 트랩 배출용 보조 노즐 — 배관 압력 연동" },
    { key: "drain", desc: "정비용 완전 배수 노즐 — 응축수 배출(출구 유량) 연동" },
    { key: "flame", desc: "설비 주변 화염 감지 구역" },
  ];

  return (
    <section className="rounded-lg p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest" style={{ color: COLORS.textDim }}>
          열교환기 3D 모델 (OpenSCAD 실측 설계 · 실시간 상태 연동)
        </h2>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: `${COLORS.cyan}14`, color: COLORS.cyan }}>
          OR-100 실측 모델
        </span>
      </div>

      <HeatExchanger3D levels={levels} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2 mt-4">
        {sections.map((s) => {
          const level = levels[s.key];
          const meta = STATUS_META[level];
          return (
            <div key={s.key} className="text-xs font-mono px-3 py-2 rounded" style={{ background: "#f8fafc", border: `1px solid ${COLORS.panelBorder}` }}>
              <div className="font-semibold" style={{ color: COLORS.textPrimary }}>
                {PIN_LABELS[s.key]}
              </div>
              <div className="mt-1 font-semibold" style={{ color: meta.color }}>
                {level === 0 ? "정상 ✅" : `${meta.label} ⚠`}
              </div>
              <div className="mt-1" style={{ color: COLORS.textDim }}>
                {s.desc}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
