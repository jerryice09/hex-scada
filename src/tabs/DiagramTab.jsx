import React from "react";
import { COLORS, STATUS_META } from "../data/constants";
import HeatExchanger3D, { PIN_LABELS } from "../components/HeatExchanger3D";

// 위험 시나리오(코드) → SOP 대응 절차상 실제로 조작해야 하는 설비 위치.
// 예) 워터해머링 SOP: "① 출구 드레인 밸브 개방  ② 입구 증기 공급 50% 감소"
//     → 드레인과 입구 두 곳 모두 조작 대상이므로, 시나리오 발생 시 둘 다 강조되어야
//       현장 작업자가 "어디를 만져야 하는지"를 한눈에 파악할 수 있다.
const SOP_AFFECTED_PINS = {
  WATER_HAMMER: ["drain", "in"], // 드레인 밸브 개방 + 입구 증기 공급 감소
  OVER_PRESSURE: ["vent", "in"], // 압력 릴리프 밸브(벤트) 작동 + 공급 차단(입구)
  FIRE_DETECTED: ["flame"], // 화염 감지 구역 자체가 대응 지점
  HEAT_FAULT: ["in", "out"], // 유량밸브 점검(입구) + 열교환 효율 재측정(출구)
};

// 문제점 개선: 기존에는 추상화된 SVG 배관도라서 실제 밸브 위치를 알기 어려웠다.
// 학생이 OpenSCAD로 실측 규격(전장 555mm, 쉘 외경 114mm 등)에 맞춰 직접 3D 모델링한
// 열교환기(입구/출구/벤트/드레인 각인 포함)를 그대로 불러와서, 신입 사원도 실물과
// 동일한 형태로 각 포트 위치를 익힐 수 있게 했다.
export default function DiagramTab({ paramLevel, dangerCodes }) {
  // 1단계: 센서값 기준 기본 레벨
  const heatFault = dangerCodes.includes("HEAT_FAULT");
  const levels = {
    in: Math.max(paramLevel.inTemp, paramLevel.inFlow, heatFault ? 3 : 0),
    out: Math.max(paramLevel.outTemp, heatFault ? 3 : 0),
    vent: paramLevel.pressure,
    drain: paramLevel.outFlow,
    flame: paramLevel.flame,
  };

  // 2단계: 현재 활성화된 위험 시나리오의 SOP 대응 위치를 전부 위험(3)으로 강제 강조.
  // 센서 자체는 정상이어도 "이 시나리오 대응을 위해 여기를 조작해야 한다"는 지시를
  // 시각적으로 놓치지 않도록 하기 위함.
  dangerCodes.forEach((code) => {
    (SOP_AFFECTED_PINS[code] || []).forEach((pinKey) => {
      levels[pinKey] = 3;
    });
  });

  const sections = [
    { key: "in", desc: "고온 유체 유입 지점 — 온도·유량 이상 또는 SOP상 공급 조작 대상일 때 강조" },
    { key: "out", desc: "유체 배출 지점 — 출구 온도 이상 시 강조" },
    { key: "vent", desc: "압력 릴리프 밸브(벤트) — 배관 압력 이상 또는 과압 SOP 대상일 때 강조" },
    { key: "drain", desc: "드레인 밸브 — 응축수 배출(출구 유량) 또는 워터해머링 SOP 대상일 때 강조" },
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
