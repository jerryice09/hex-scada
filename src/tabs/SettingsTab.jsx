import React from "react";
import { Settings as SettingsIcon, Save, Undo2, Wifi, WifiOff } from "lucide-react";
import { COLORS } from "../data/constants";
import ThresholdRow from "../components/ThresholdRow";

// draftThresholds/setDraftThresholds: 입력 중인 값 (아직 미적용)
// onSave/onReset: App.jsx에서 검증 후 실제 thresholds 상태에 반영하는 핸들러
// validationErrors: App.jsx의 validateThresholds() 결과 중 errors 배열 (있으면 저장 버튼 클릭 시 화면에 표시)
export default function SettingsTab({ draftThresholds, setDraftThresholds, onSave, onReset, validationErrors, hwMode, setHwMode, hwOnline, hwLastSeen }) {
  return (
    <section className="rounded-lg p-5 flex flex-col gap-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
      {/* 데이터 소스 전환: 시뮬레이션 ↔ 실시간 하드웨어(ESP32) */}
      <div className="rounded-md p-4 flex flex-col gap-2" style={{ background: "#f8fafc", border: `1px solid ${COLORS.panelBorder}` }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {hwMode && hwOnline ? <Wifi size={16} style={{ color: COLORS.normal }} /> : <WifiOff size={16} style={{ color: COLORS.textDim }} />}
            <span className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
              데이터 소스
            </span>
          </div>
          <button
            onClick={() => setHwMode((v) => !v)}
            className="px-3 py-1.5 rounded-md text-xs font-mono font-semibold"
            style={{
              background: hwMode ? `${COLORS.normal}22` : `${COLORS.panelBorderLit}33`,
              color: hwMode ? COLORS.normal : COLORS.textDim,
              border: `1px solid ${hwMode ? COLORS.normal : COLORS.panelBorderLit}`,
            }}
          >
            {hwMode ? "🔌 실시간 하드웨어(ESP32) 사용 중" : "🖥 시뮬레이션 사용 중 — 클릭해서 전환"}
          </button>
        </div>
        <p className="text-[11px] font-mono" style={{ color: COLORS.textDim }}>
          {hwMode
            ? `/api/sensors를 1초마다 조회합니다. ${hwOnline ? "ESP32로부터 정상 수신 중입니다." : "아직 ESP32로부터 데이터를 받지 못했거나 연결이 끊겼습니다 (5초 이상 미수신)."}`
            : "꺼져 있으면 화면에 표시되는 값은 전부 시뮬레이션(지터/시나리오)입니다. ESP32 배선·배포가 끝났다면 켜서 실제 값으로 전환하세요."}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <SettingsIcon size={16} style={{ color: COLORS.cyan }} />
        <h2 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
          임계값 설정
        </h2>
      </div>
      <p className="text-xs font-mono px-3 py-2 rounded-md" style={{ background: "rgba(14,165,233,0.08)", color: COLORS.textDim, border: `1px solid ${COLORS.cyan}33` }}>
        현재 시스템은 여수석유화학고 실습 환경 기준값으로 운전 중입니다. 아래에서 현장별 임계값을 수정하면 즉시 반영됩니다.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ThresholdRow label="입구 온도" unit="℃" keyName="inTemp" draft={draftThresholds} setDraftThresholds={setDraftThresholds} />
        <ThresholdRow label="출구 온도" unit="℃" keyName="outTemp" draft={draftThresholds} setDraftThresholds={setDraftThresholds} />
        <ThresholdRow label="입구 유량" unit="L/min" keyName="inFlow" draft={draftThresholds} setDraftThresholds={setDraftThresholds} />
        <ThresholdRow label="출구 유량" unit="L/min" keyName="outFlow" draft={draftThresholds} setDraftThresholds={setDraftThresholds} />
        <ThresholdRow label="배관 압력" unit="kPa" keyName="pressure" draft={draftThresholds} setDraftThresholds={setDraftThresholds} />
        <ThresholdRow label="화염 감지" unit="%" keyName="flame" draft={draftThresholds} setDraftThresholds={setDraftThresholds} />
      </div>

      {/* 하한 ≥ 상한, 빈 값 등 저장 직전 검증에 실패하면 표시되는 에러 목록 */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="text-xs font-mono px-3 py-2 rounded-md flex flex-col gap-1" style={{ background: `${COLORS.danger}14`, border: `1px solid ${COLORS.danger}44`, color: "#991b1b" }}>
          {validationErrors.map((e, i) => (
            <div key={i}>⚠ {e}</div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-1">
        <button onClick={onSave} className="px-4 py-2.5 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: COLORS.cyan, color: "#ffffff" }}>
          <Save size={15} /> 저장 및 적용
        </button>
        <button
          onClick={onReset}
          className="px-4 py-2.5 rounded-md text-sm font-semibold flex items-center gap-2"
          style={{ background: "transparent", border: `1px solid ${COLORS.panelBorderLit}`, color: COLORS.textPrimary }}
        >
          <Undo2 size={15} /> 기본값으로 초기화
        </button>
      </div>

      <p className="text-[11px] font-mono mt-2" style={{ color: COLORS.textDim }}>
        본 설정 기능은 실제 산업 현장의 공정 조건에 맞춰 시스템을 즉시 재구성할 수 있음을 시연합니다.
      </p>
    </section>
  );
}
