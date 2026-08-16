import React from "react";
import { Clock } from "lucide-react";
import { COLORS, STATUS_META, SENSOR_LABELS } from "../data/constants";
import RiskGauge from "../components/RiskGauge";

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
        <div
          className="rounded-md p-3 text-sm font-semibold"
          style={{
            background: hasWarningTrend ? `${COLORS.danger}18` : `${COLORS.normal}18`,
            color: hasWarningTrend ? COLORS.danger : COLORS.normal,
            border: `1px solid ${hasWarningTrend ? COLORS.danger : COLORS.normal}44`,
          }}
        >
          {hasWarningTrend
            ? `⏱ 위험 도달 예상: 약 ${Math.max(0, Math.round(topPrediction.minutes))}분 후 (${SENSOR_LABELS[topPrediction.key]})`
            : "✅ 현재 안전 — 이상 징후 없음"}
        </div>
        {/* 최근 10개 포인트 선형회귀 기울기 기반 추정치이므로 데이터가 짧을수록 오차가 커질 수 있음(참고용) */}
        <div className="flex flex-col gap-1.5">
          {predictions.map((p) => (
            <div key={p.key} className="flex items-center justify-between text-xs font-mono px-2 py-1.5 rounded" style={{ background: "#f1f5f9" }}>
              <span style={{ color: COLORS.textDim }}>{SENSOR_LABELS[p.key]}</span>
              <span style={{ color: p.fault ? COLORS.fault : p.minutes === Infinity ? COLORS.normal : p.minutes <= 5 ? COLORS.danger : COLORS.caution }}>
                {p.fault ? "SENSOR FAULT · 예측 제외" : p.minutes === Infinity ? "추세 없음 · 안전" : `약 ${Math.max(0, Math.round(p.minutes))}분 후`}
              </span>
            </div>
          ))}
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
