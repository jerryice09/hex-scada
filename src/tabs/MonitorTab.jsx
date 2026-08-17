import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { Power, RotateCcw, Thermometer, Droplets, Gauge, Flame } from "lucide-react";
import { COLORS, UNITS, SCENARIOS } from "../data/constants";
import { fmt } from "../utils/calculations";
import SensorCard from "../components/SensorCard";

const SCENARIO_LABEL_KEYS = {
  normal: "scenario_normal",
  waterHammer: "scenario_waterHammer",
  fireDetected: "scenario_fireDetected",
  overPressure: "scenario_overPressure",
  heatExchangeFault: "scenario_heatExchangeFault",
};
const SENSOR_KEY_MAP = { inTemp: "sensor_inTemp", outTemp: "sensor_outTemp", inFlow: "sensor_inFlow", outFlow: "sensor_outFlow", pressure: "sensor_pressure", flame: "sensor_flame" };
const STATUS_KEYS = ["status_normal", "status_caution", "status_warning", "status_danger"];

export default function MonitorTab({ values, paramLevel, faultMap, thresholds, history, activeScenario, isTransitioning, runScenario, incidents, hwMode, t }) {
  const recentIncidents = incidents.slice(0, 10);
  // ④ 차트 경보 마커: incidents에 저장해둔 tick 번호에 세로 점선을 그린다.
  const alarmMarks = incidents.map((i) => ({ tick: i.tick, label: `${t(`code_${i.code}`)} — ${t(`msg_${i.code}`)}` }));

  const sensorSub = (key) => `${t("normal_range_prefix")} ${thresholds[key].min}~${thresholds[key].max}${UNITS[key]}`;

  // 차트 보기 모드: "full" = 모니터링 시작(0초)부터 누적된 경과 시간을 전부 보여줌
  // (60초가 지나면 자동으로 분 단위 눈금으로 전환), "zoom" = 최근 20개 포인트만
  // 놓고 다시 초 단위 상세로 확대해서 보는 모드.
  const [chartMode, setChartMode] = useState("full");
  const chartData = chartMode === "zoom" ? history.slice(-20) : history;

  // "전체" 모드: 경과 초(sec)를 그대로 라벨로 사용, 60초 이후부터는 분 단위로 표기
  const formatElapsed = (sec) => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s === 0 ? `${m}m` : `${m}m${s}s`;
  };

  // "확대(최근 20초)" 모드: 현재 슬라이스의 마지막 포인트를 "지금"으로 두고 상대 시간(몇 초 전)으로 표기
  const latestZoomTick = chartData.length > 0 ? chartData[chartData.length - 1].t : 0;
  const formatZoomRelative = (sec) => {
    const diff = sec - latestZoomTick;
    return diff === 0 ? "0s" : `-${Math.abs(diff)}s`;
  };

  const xTickFormatter = chartMode === "zoom" ? formatZoomRelative : formatElapsed;
  // 포인트가 많아질수록(전체 모드) x축 라벨이 빽빽해지므로, 대략 8개 안팎만 보이게 간격을 자동 조정
  const xTickInterval = chartMode === "zoom" ? 0 : Math.max(0, Math.ceil(chartData.length / 8) - 1);

  const ChartModeToggle = () => (
    <div className="flex items-center gap-1.5 mb-2">
      {[
        { key: "full", label: t("chart_mode_full") },
        { key: "zoom", label: t("chart_mode_zoom") },
      ].map((m) => (
        <button
          key={m.key}
          onClick={() => setChartMode(m.key)}
          className="text-[11px] font-mono px-2.5 py-1 rounded-full"
          style={{
            background: chartMode === m.key ? COLORS.cyan : "#f1f5f9",
            color: chartMode === m.key ? "#ffffff" : COLORS.textDim,
            border: `1px solid ${chartMode === m.key ? COLORS.cyan : COLORS.panelBorder}`,
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  const renderAlarmReferenceLines = (keyPrefix) =>
    alarmMarks.map((m, i) => (
      <ReferenceLine
        key={`${keyPrefix}-${m.tick}-${i}`}
        x={m.tick}
        stroke={COLORS.danger}
        strokeDasharray="4 4"
        label={(props) => {
          const { viewBox } = props;
          return (
            <g>
              <text x={viewBox.x} y={12} fill={COLORS.danger} fontSize={11} textAnchor="middle">
                ⚠<title>{m.label}</title>
              </text>
            </g>
          );
        }}
      />
    ));

  return (
    <>
      <section>
        <h2 className="text-xs uppercase tracking-widest mb-2" style={{ color: COLORS.textDim }}>
          {t("sensor_panel_title")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <SensorCard icon={Thermometer} label={t(SENSOR_KEY_MAP.inTemp)} value={fmt(values.inTemp)} unit="℃" sub={sensorSub("inTemp")} level={paramLevel.inTemp} fault={faultMap.inTemp} statusLabel={t(STATUS_KEYS[paramLevel.inTemp])} faultNote={t("fault_card_note")} />
          <SensorCard icon={Thermometer} label={t(SENSOR_KEY_MAP.outTemp)} value={fmt(values.outTemp)} unit="℃" sub={sensorSub("outTemp")} level={paramLevel.outTemp} fault={faultMap.outTemp} statusLabel={t(STATUS_KEYS[paramLevel.outTemp])} faultNote={t("fault_card_note")} />
          <SensorCard icon={Droplets} label={t(SENSOR_KEY_MAP.inFlow)} value={fmt(values.inFlow, 2)} unit="L/min" sub={`${sensorSub("inFlow")} (G1/2 Brass)`} level={paramLevel.inFlow} fault={faultMap.inFlow} statusLabel={t(STATUS_KEYS[paramLevel.inFlow])} faultNote={t("fault_card_note")} />
          <SensorCard icon={Droplets} label={t(SENSOR_KEY_MAP.outFlow)} value={fmt(values.outFlow, 2)} unit="L/min" sub={`${sensorSub("outFlow")} (YF-S201)`} level={paramLevel.outFlow} fault={faultMap.outFlow} statusLabel={t(STATUS_KEYS[paramLevel.outFlow])} faultNote={t("fault_card_note")} />
          <SensorCard icon={Gauge} label={t(SENSOR_KEY_MAP.pressure)} value={fmt(values.pressure, 0)} unit="kPa" sub={sensorSub("pressure")} level={paramLevel.pressure} fault={faultMap.pressure} statusLabel={t(STATUS_KEYS[paramLevel.pressure])} faultNote={t("fault_card_note")} />
          <SensorCard icon={Flame} label={t(SENSOR_KEY_MAP.flame)} value={fmt(values.flame, 0)} unit="%" sub={`${t("status_danger")} ${thresholds.flame.max * 6}% >`} level={paramLevel.flame} fault={faultMap.flame} statusLabel={t(STATUS_KEYS[paramLevel.flame])} faultNote={t("fault_card_note")} />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 rounded-lg p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
          <h2 className="text-xs uppercase tracking-widest mb-1" style={{ color: COLORS.textDim }}>
            {t("chart_temp_title")}
          </h2>
          <ChartModeToggle />
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.panelBorder} />
              <XAxis dataKey="t" tickFormatter={xTickFormatter} interval={xTickInterval} tick={{ fill: COLORS.textDim, fontSize: 10 }} stroke={COLORS.panelBorder} minTickGap={20} />
              <YAxis tick={{ fill: COLORS.textDim, fontSize: 10 }} stroke={COLORS.panelBorder} domain={[0, 100]} />
              <Tooltip labelFormatter={xTickFormatter} contentStyle={{ background: "#ffffff", border: `1px solid ${COLORS.panelBorderLit}`, fontSize: 12, boxShadow: "0 4px 16px rgba(15,23,42,0.12)" }} labelStyle={{ color: COLORS.textDim }} />
              <Legend wrapperStyle={{ fontSize: 11, color: COLORS.textDim }} />
              {renderAlarmReferenceLines("t")}
              <Line type="monotone" dataKey="inTemp" name={t(SENSOR_KEY_MAP.inTemp)} stroke={COLORS.cyan} dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="outTemp" name={t(SENSOR_KEY_MAP.outTemp)} stroke="#f472b6" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>

          <h2 className="text-xs uppercase tracking-widest mb-1 mt-4" style={{ color: COLORS.textDim }}>
            {t("chart_flow_title")}
          </h2>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.panelBorder} />
              <XAxis dataKey="t" tickFormatter={xTickFormatter} interval={xTickInterval} tick={{ fill: COLORS.textDim, fontSize: 10 }} stroke={COLORS.panelBorder} minTickGap={20} />
              <YAxis tick={{ fill: COLORS.textDim, fontSize: 10 }} stroke={COLORS.panelBorder} domain={[0, 14]} />
              <Tooltip labelFormatter={xTickFormatter} contentStyle={{ background: "#ffffff", border: `1px solid ${COLORS.panelBorderLit}`, fontSize: 12, boxShadow: "0 4px 16px rgba(15,23,42,0.12)" }} labelStyle={{ color: COLORS.textDim }} />
              <Legend wrapperStyle={{ fontSize: 11, color: COLORS.textDim }} />
              {renderAlarmReferenceLines("f")}
              <Line type="monotone" dataKey="inFlow" name={t(SENSOR_KEY_MAP.inFlow)} stroke={COLORS.normal} dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="outFlow" name={t(SENSOR_KEY_MAP.outFlow)} stroke="#a78bfa" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="flex flex-col gap-5">
          <div className="rounded-lg p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
            <h2 className="text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: COLORS.textDim }}>
              <Power size={12} /> {t("scenario_sim_title")}
            </h2>
            {hwMode && (
              <p className="text-xs font-mono px-3 py-2 rounded-md mb-2" style={{ background: "rgba(14,165,233,0.08)", color: COLORS.textDim, border: `1px solid ${COLORS.cyan}33` }}>
                {t("hw_mode_notice")}
              </p>
            )}
            <div className="grid grid-cols-1 gap-2" style={{ opacity: hwMode ? 0.4 : 1, pointerEvents: hwMode ? "none" : "auto" }}>
              {Object.entries(SCENARIOS).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => runScenario(key)}
                  disabled={isTransitioning || hwMode}
                  className="text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors"
                  style={{
                    background: activeScenario === key ? "#eff6ff" : "#f8fafc",
                    border: `1px solid ${activeScenario === key ? COLORS.panelBorderLit : COLORS.panelBorder}`,
                    color: COLORS.textPrimary,
                    opacity: isTransitioning && activeScenario !== key ? 0.5 : 1,
                    cursor: isTransitioning ? "wait" : "pointer",
                  }}
                >
                  <span>{s.icon}</span>
                  <span className="font-medium">{t(SCENARIO_LABEL_KEYS[key])}</span>
                  {activeScenario === key && isTransitioning && (
                    <span className="ml-auto text-[10px] font-mono animate-pulse" style={{ color: COLORS.cyan }}>
                      {t("transitioning")}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[11px] font-mono mt-2 flex items-center gap-1" style={{ color: COLORS.textDim }}>
              <RotateCcw size={11} /> {t("scenario_sim_note")}
            </p>
          </div>

          <div className="rounded-lg p-4 flex-1 flex flex-col" style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}>
            <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: COLORS.textDim }}>
              {t("alarm_log_title")}
            </h2>
            <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 260 }}>
              {recentIncidents.length === 0 && (
                <p className="text-xs font-mono" style={{ color: COLORS.textDim }}>
                  {t("alarm_log_empty")}
                </p>
              )}
              {recentIncidents.map((entry) => (
                <div key={entry.id} className="text-xs font-mono px-2.5 py-2 rounded" style={{ background: "rgba(220,38,38,0.06)", border: `1px solid ${COLORS.danger}33` }}>
                  <span style={{ color: COLORS.textDim }}>[{entry.time}]</span> <span style={{ color: "#991b1b" }}>{t(`msg_${entry.code}`)}</span>
                  {entry.resolved && (
                    <div className="mt-1" style={{ color: COLORS.normal }}>
                      ✅ {entry.resolvedTime} {t("resolved_confirmed_at")}
                    </div>
                  )}
                  {!entry.resolved && entry.acknowledged && (
                    <div className="mt-1" style={{ color: COLORS.cyan }}>
                      🔖 {entry.ackTime} {t("ack_confirmed_at")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
