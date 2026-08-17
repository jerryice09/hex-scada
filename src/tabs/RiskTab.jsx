import React from "react";
import { Clock } from "lucide-react";
import { COLORS, STATUS_META, SENSOR_LABELS } from "../data/constants";
import RiskGauge from "../components/RiskGauge";

// 문제점 수정: 예전엔 초 단위 예측값을 항상 분 단위로 반올림해서 보여줬다.
// 5초짜리 시나리오 전환처럼 아주 빠르게 진행되는 경우 반올림하면 항상 "0분"으로만 보여서
// 마치 예측이 전혀 안 되는 것처럼 보이는 문제가 있었다. 1분 미만이면 초 단위로 보여준다.
function formatEta(ticksSeconds) {
  if (ticksSeconds < 60) {
    const s = Math.max(1, Math.round(ticksSeconds));
    return `약 ${s}초 후`;
  }
  return `약 ${Math.round(ticksSeconds / 60)}분 후`;
}

export default function RiskTab({ riskScore, bucket, predictions, topPrediction, hasWarningTrend, paramLevel, faultMap }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <section className="rounded-lg p-4 flex flex-col items-center justify-center gap-2" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
        <h2 className="text-xs uppercase tracking-widest self-start" style={{ color: COLORS.textDim }}>
          종합 Risk Score
        </h2>
        <RiskGauge score={riskScore} bucket={bucket} />
        <p className="text-[11px] font-mono text-center" style={{ color: COLORS.textDim }}>
          유량 30% · 압력 25% · 온도 25% · 화염 20% 가중 합산 (센서 오류 항목은 제외 후 재정규화)
        </p>
      </section>

      <section className="rounded-lg p-4 flex flex-col gap-3" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
        <h2 className="text-xs uppercase tracking-widest flex items-center gap-1.5" style={{ color: COLORS.textDim }}>
          <Clock size={13} /> AI 고장 예측 타이머
        </h2>
        {(() => {
          // 문제점 수정: "추세 없음"이면 무조건 "현재 안전"이라고 표시했었다.
          // 트렌드는 없어도 이미 경고·위험 레벨에 머물러 있는 센서가 있을 수 있으므로,
          // 그 경우엔 "안전"이 아니라 "현재 상태 유지 중"으로 정확히 안내한다.
          const activeLevels = Object.entries(paramLevel)
            .filter(([key]) => !faultMap[key])
            .map(([, lvl]) => lvl);
          const currentMaxLevel = activeLevels.length > 0 ? Math.max(...activeLevels) : 0;

          if (hasWarningTrend) {
            if (topPrediction.already) {
              return (
                <div className="rounded-md p-3 text-sm font-semibold" style={{ background: `${COLORS.danger}18`, color: COLORS.danger, border: `1px solid ${COLORS.danger}44` }}>
                  🚨 이미 위험 상태입니다 — 즉시 조치가 필요합니다 ({SENSOR_LABELS[topPrediction.key]})
                </div>
              );
            }
            return (
              <div className="rounded-md p-3 text-sm font-semibold" style={{ background: `${COLORS.danger}18`, color: COLORS.danger, border: `1px solid ${COLORS.danger}44` }}>
                ⏱ 위험 도달 예상: {formatEta(topPrediction.ticks)} ({SENSOR_LABELS[topPrediction.key]})
              </div>
            );
          }
          if (currentMaxLevel > 0) {
            const meta = STATUS_META[currentMaxLevel];
            return (
              <div className="rounded-md p-3 text-sm font-semibold" style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}44` }}>
                ⚠ 추가 악화 추세는 없지만, 현재 {meta.label} 상태가 유지되고 있습니다
              </div>
            );
          }
          return (
            <div className="rounded-md p-3 text-sm font-semibold" style={{ background: `${COLORS.normal}18`, color: COLORS.normal, border: `1px solid ${COLORS.normal}44` }}>
              ✅ 현재 안전 — 이상 징후 없음
            </div>
          );
        })()}
        {/* 최근 10개 포인트 선형회귀 기울기 기반 추정치이므로 데이터가 짧을수록 오차가 커질 수 있음(참고용) */}
        <div className="flex flex-col gap-1.5">
          {predictions.map((p) => {
            const currentLevel = paramLevel[p.key] ?? 0;
            let text;
            let color;
            if (p.fault) {
              text = "SENSOR FAULT · 예측 제외";
              color = COLORS.fault;
            } else if (p.already) {
              text = "이미 위험 상태";
              color = COLORS.danger;
            } else if (p.minutes !== Infinity) {
              // 실제로 임계값 쪽으로 이동 중인 추세가 감지된 경우 — 얼마나 급한지로 색상 구분
              text = formatEta(p.ticks);
              color = p.ticks <= 300 ? COLORS.danger : COLORS.caution;
            } else if (currentLevel === 0) {
              // 문제점 수정: 예전엔 "추세 없음"이면 현재 상태와 무관하게 무조건 "안전"이라고 표시했다.
              // 하지만 "추세 없음"은 "더 나빠지지 않는다"는 뜻일 뿐, 이미 경고·위험 상태에
              // 멈춰있는 경우까지 안전으로 잘못 보여줄 수 있어 현재 레벨을 함께 반영한다.
              text = "추세 없음 · 안전";
              color = COLORS.normal;
            } else {
              text = `추세 없음 · ${STATUS_META[currentLevel].label} 상태 유지`;
              color = STATUS_META[currentLevel].color;
            }
            return (
              <div key={p.key} className="flex items-center justify-between text-xs font-mono px-2 py-1.5 rounded" style={{ background: "#f1f5f9" }}>
                <span style={{ color: COLORS.textDim }}>{SENSOR_LABELS[p.key]}</span>
                <span style={{ color }}>{text}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg p-4 flex flex-col gap-2" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
        <h2 className="text-xs uppercase tracking-widest mb-1" style={{ color: COLORS.textDim }}>
          센서별 상태 요약
        </h2>
        {Object.entries(paramLevel).map(([key, level]) => {
          const isFault = faultMap[key];
          const meta = STATUS_META[level];
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs font-mono w-16 flex-shrink-0" style={{ color: COLORS.textDim }}>
                {SENSOR_LABELS[key]}
              </span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: isFault ? "100%" : `${((level + 1) / 4) * 100}%`, background: isFault ? COLORS.fault : meta.color, transition: "width 0.4s ease" }}
                />
              </div>
              <span className="text-[11px] font-mono w-14 text-right" style={{ color: isFault ? COLORS.fault : meta.color }}>
                {isFault ? "FAULT" : meta.label}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}
