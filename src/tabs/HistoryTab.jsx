import React from "react";
import { History as HistoryIcon, ShieldAlert, CheckCircle2 } from "lucide-react";
import { COLORS } from "../data/constants";

// onAcknowledge(id): 사고 이력 탭에서 [인지 완료] 클릭 시 호출.
// App.jsx에서 해당 incident.acknowledged=true 처리 + 대기 중인 SOP 팝업 제거를 수행한다.
export default function HistoryTab({ incidents, unresolvedCount, resolvedCount, onAcknowledge, t }) {
  return (
    <section className="rounded-lg p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xs uppercase tracking-widest flex items-center gap-1.5" style={{ color: COLORS.textDim }}>
          <HistoryIcon size={13} /> {t("history_title")}
        </h2>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span style={{ color: COLORS.textPrimary }}>
            {t("total_alarms")} <span style={{ color: COLORS.danger }}>{incidents.length}</span>
            {t("unit_count")}
          </span>
          <span style={{ color: COLORS.textPrimary }}>
            {t("resolved_count")} <span style={{ color: COLORS.normal }}>{resolvedCount}</span>
            {t("unit_count")}
          </span>
          <span style={{ color: COLORS.textPrimary }}>
            {t("unresolved_count")} <span style={{ color: COLORS.warning }}>{unresolvedCount}</span>
            {t("unit_count")}
          </span>
        </div>
      </div>

      {incidents.length === 0 && (
        <p className="text-sm font-mono" style={{ color: COLORS.textDim }}>
          {t("empty_history")}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {incidents.map((entry) => (
          <div key={entry.id} className="rounded-md p-3" style={{ background: "rgba(220,38,38,0.05)", border: `1px solid ${COLORS.danger}33` }}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="text-sm font-mono" style={{ color: "#991b1b" }}>
                <span style={{ color: COLORS.textDim }}>[{entry.time}]</span> <span className="font-semibold">{t(`code_${entry.code}`)}</span> — {t(`msg_${entry.code}`)}
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
                    <ShieldAlert size={11} /> {t("ack_button")}
                  </button>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: `${COLORS.cyan}1a`, color: COLORS.cyan }}>
                    🔖 {t("ack_confirmed_at")} {entry.ackTime}
                  </span>
                )}
              </div>
            </div>
            {entry.resolved && (
              <div className="mt-2 text-xs font-mono flex items-center gap-1.5" style={{ color: COLORS.normal }}>
                <CheckCircle2 size={13} /> {entry.resolvedTime} {t("resolved_confirmed_at")}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
