import React from "react";
import { History as HistoryIcon, ShieldAlert, CheckCircle2 } from "lucide-react";
import { COLORS, CODE_LABELS } from "../data/constants";

// onAcknowledge(id): 사고 이력 탭에서 [인지 완료] 클릭 시 호출.
// App.jsx에서 해당 incident.acknowledged=true 처리 + 대기 중인 SOP 팝업 제거를 수행한다.
export default function HistoryTab({ incidents, unresolvedCount, resolvedCount, onAcknowledge }) {
  return (
    <section className="rounded-lg p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xs uppercase tracking-widest flex items-center gap-1.5" style={{ color: COLORS.textDim }}>
          <HistoryIcon size={13} /> 사고 이력 타임라인
        </h2>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span style={{ color: COLORS.textPrimary }}>
            총 경보 <span style={{ color: COLORS.danger }}>{incidents.length}</span>건
          </span>
          <span style={{ color: COLORS.textPrimary }}>
            조치 완료 <span style={{ color: COLORS.normal }}>{resolvedCount}</span>건
          </span>
          <span style={{ color: COLORS.textPrimary }}>
            미조치 <span style={{ color: COLORS.warning }}>{unresolvedCount}</span>건
          </span>
        </div>
      </div>

      {incidents.length === 0 && (
        <p className="text-sm font-mono" style={{ color: COLORS.textDim }}>
          기록된 사고 이력이 없습니다. 시나리오 시뮬레이터로 위험 상황을 테스트해보세요.
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {incidents.map((entry) => (
          <div key={entry.id} className="rounded-md p-3" style={{ background: "rgba(220,38,38,0.05)", border: `1px solid ${COLORS.danger}33` }}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="text-sm font-mono" style={{ color: "#991b1b" }}>
                <span style={{ color: COLORS.textDim }}>[{entry.time}]</span> <span className="font-semibold">{CODE_LABELS[entry.code]}</span> — {entry.text}
              </div>
              <div className="flex gap-1.5 flex-wrap items-center">
                {entry.refBadges.map((b, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: `${COLORS.cyan}1a`, color: COLORS.cyan, border: `1px solid ${COLORS.cyan}44` }}>
                    {b}
                  </span>
                ))}
                {/* ① 개별 Acknowledge 처리: 아직 인지 전이면 버튼, 인지했으면 완료 뱃지 */}
                {!entry.acknowledged ? (
                  <button
                    onClick={() => onAcknowledge(entry.id)}
                    className="text-[11px] px-2.5 py-1 rounded-md font-mono flex items-center gap-1"
                    style={{ background: `${COLORS.cyan}1a`, color: COLORS.cyan, border: `1px solid ${COLORS.cyan}55` }}
                  >
                    <ShieldAlert size={11} /> 인지 완료
                  </button>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: `${COLORS.cyan}1a`, color: COLORS.cyan }}>
                    🔖 인지 완료 {entry.ackTime}
                  </span>
                )}
              </div>
            </div>
            {entry.resolved && (
              <div className="mt-2 text-xs font-mono flex items-center gap-1.5" style={{ color: COLORS.normal }}>
                <CheckCircle2 size={13} /> {entry.resolvedTime} 조치 완료 확인됨
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
