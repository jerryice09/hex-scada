import React from "react";
import { Settings as SettingsIcon, Save, Undo2, Wifi, WifiOff } from "lucide-react";
import { COLORS } from "../data/constants";
import ThresholdRow from "../components/ThresholdRow";

const SENSOR_KEY_MAP = { inTemp: "sensor_inTemp", outTemp: "sensor_outTemp", inFlow: "sensor_inFlow", outFlow: "sensor_outFlow", pressure: "sensor_pressure", flame: "sensor_flame" };

// draftThresholds/setDraftThresholds: 입력 중인 값 (아직 미적용)
// onSave/onReset: App.jsx에서 검증 후 실제 thresholds 상태에 반영하는 핸들러
// validationErrors: App.jsx의 validateThresholds() 결과 중 errors 배열 (있으면 저장 버튼 클릭 시 화면에 표시)
export default function SettingsTab({ draftThresholds, setDraftThresholds, onSave, onReset, validationErrors, hwMode, setHwMode, hwOnline, hwLastSeen, t }) {
  return (
    <section className="rounded-lg p-5 flex flex-col gap-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
      {/* 데이터 소스 전환: 시뮬레이션 ↔ 실시간 하드웨어(ESP32) */}
      <div className="rounded-md p-4 flex flex-col gap-2" style={{ background: "#f8fafc", border: `1px solid ${COLORS.panelBorder}` }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {hwMode && hwOnline ? <Wifi size={16} style={{ color: COLORS.normal }} /> : <WifiOff size={16} style={{ color: COLORS.textDim }} />}
            <span className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
              {t("settings_data_source_title")}
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
            {hwMode ? t("settings_hw_on") : t("settings_hw_off")}
          </button>
        </div>
        <p className="text-[11px] font-mono" style={{ color: COLORS.textDim }}>
          {hwMode ? (hwOnline ? t("settings_hw_on_desc_online") : t("settings_hw_on_desc_offline")) : t("settings_hw_off_desc")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <SettingsIcon size={16} style={{ color: COLORS.cyan }} />
        <h2 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
          {t("settings_threshold_title")}
        </h2>
      </div>
      <p className="text-xs font-mono px-3 py-2 rounded-md" style={{ background: "rgba(14,165,233,0.08)", color: COLORS.textDim, border: `1px solid ${COLORS.cyan}33` }}>
        {t("settings_threshold_notice")}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ThresholdRow label={t(SENSOR_KEY_MAP.inTemp)} unit="℃" keyName="inTemp" draft={draftThresholds} setDraftThresholds={setDraftThresholds} t={t} />
        <ThresholdRow label={t(SENSOR_KEY_MAP.outTemp)} unit="℃" keyName="outTemp" draft={draftThresholds} setDraftThresholds={setDraftThresholds} t={t} />
        <ThresholdRow label={t(SENSOR_KEY_MAP.inFlow)} unit="L/min" keyName="inFlow" draft={draftThresholds} setDraftThresholds={setDraftThresholds} t={t} />
        <ThresholdRow label={t(SENSOR_KEY_MAP.outFlow)} unit="L/min" keyName="outFlow" draft={draftThresholds} setDraftThresholds={setDraftThresholds} t={t} />
        <ThresholdRow label={t(SENSOR_KEY_MAP.pressure)} unit="kPa" keyName="pressure" draft={draftThresholds} setDraftThresholds={setDraftThresholds} t={t} />
        <ThresholdRow label={t(SENSOR_KEY_MAP.flame)} unit="%" keyName="flame" draft={draftThresholds} setDraftThresholds={setDraftThresholds} t={t} />
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
          <Save size={15} /> {t("save_button")}
        </button>
        <button
          onClick={onReset}
          className="px-4 py-2.5 rounded-md text-sm font-semibold flex items-center gap-2"
          style={{ background: "transparent", border: `1px solid ${COLORS.panelBorderLit}`, color: COLORS.textPrimary }}
        >
          <Undo2 size={15} /> {t("reset_button")}
        </button>
      </div>

      <p className="text-[11px] font-mono mt-2" style={{ color: COLORS.textDim }}>
        {t("settings_footer_note")}
      </p>
    </section>
  );
}
