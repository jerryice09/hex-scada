import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";
import "./styles/scada.css";

import {
  COLORS,
  STATUS_META,
  NORMAL_BASELINE,
  DEFAULT_THRESHOLDS,
  SCENARIOS,
  TRANSITION_MS,
  TRANSITION_STEP_MS,
  TICK_MS,
  TABS,
  PRIORITY_ORDER,
  MAX_INCIDENT_HISTORY,
  MAX_CHART_HISTORY,
} from "./data/constants";
import {
  lerp,
  easeInOutCubic,
  jitter,
  nowStr,
  linRegSlope,
  ticksToDeviationThreshold,
  ticksToLowerThreshold,
  ticksToUpperThreshold,
  isSensorFault,
  evaluateStatus,
  getRefBadges,
  computeRiskScore,
  riskBucket,
  nominalOf,
  validateThresholds,
} from "./utils/calculations";

import SopModal from "./components/SopModal";
import Toast from "./components/Toast";
import MonitorTab from "./tabs/MonitorTab";
import RiskTab from "./tabs/RiskTab";
import DiagramTab from "./tabs/DiagramTab";
import HistoryTab from "./tabs/HistoryTab";
import SettingsTab from "./tabs/SettingsTab";

export default function HeatExchangerSCADA() {
  const [values, setValues] = useState({ ...NORMAL_BASELINE });
  const [baseline, setBaseline] = useState({ ...NORMAL_BASELINE });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeScenario, setActiveScenario] = useState("normal");
  const [history, setHistory] = useState(() => [{ t: 0, ...NORMAL_BASELINE }]);
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState("monitor");
  const [lastNormalTime, setLastNormalTime] = useState(() => nowStr());

  // 실시간 하드웨어(ESP32) 연동 모드 — true면 시뮬레이션 지터 대신 /api/sensors를 폴링한다.
  const [hwMode, setHwMode] = useState(false);
  const [hwOnline, setHwOnline] = useState(false);
  const [hwLastSeen, setHwLastSeen] = useState(null);

  // 임계값 설정 (설정 탭에서 즉시 반영)
  const [thresholds, setThresholds] = useState({ ...DEFAULT_THRESHOLDS });
  const [draftThresholds, setDraftThresholds] = useState({ ...DEFAULT_THRESHOLDS });
  const [validationErrors, setValidationErrors] = useState([]);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // 사고 이력 / SOP 팝업 관련 상태
  const [incidents, setIncidents] = useState([]);
  // sopQueue: { id, priority }[] — 우선순위(PRIORITY_ORDER)순으로 정렬된 대기열
  const [sopQueue, setSopQueue] = useState([]);
  const [activeSop, setActiveSop] = useState(null);

  const tickCounter = useRef(1);
  const transitionRef = useRef(null);
  const lastDangerCodes = useRef(new Set());
  const incidentSeq = useRef(0); // 사고 ID 순번 (Date.now() 충돌 가능성 제거)
  // 코드별 "마지막으로 사고를 생성한 시각"을 기록해, 노이즈로 인한 짧은 깜빡임(위험→정상→위험)이
  // 매번 새 사고로 잡히지 않도록 최근에 이미 생성한 코드는 잠시 억제한다.
  const lastIncidentAtByCode = useRef({});
  const REPEAT_SUPPRESS_MS = 8000;
  // 히스토리 누적용 setInterval이 매초 values가 바뀔 때마다 재시작되지 않도록,
  // 최신 values를 ref로 별도 보관해서 읽는다 (문제점 수정: 아래 히스토리 effect 설명 참고)
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // 센서 오류(SENSOR FAULT) 판정 — 물리적으로 불가능한 값이면 판단 로직에서 제외
  // isSensorFault는 thresholds를 함께 받아, 사용자가 설정 탭에서 범위를 넓혀도
  // 오탐(false FAULT)이 나지 않도록 판정 상한을 동적으로 완충한다.
  const faultMap = {
    inTemp: isSensorFault("inTemp", values.inTemp, thresholds),
    outTemp: isSensorFault("outTemp", values.outTemp, thresholds),
    inFlow: isSensorFault("inFlow", values.inFlow, thresholds),
    outFlow: isSensorFault("outFlow", values.outFlow, thresholds),
    pressure: isSensorFault("pressure", values.pressure, thresholds),
    flame: isSensorFault("flame", values.flame, thresholds),
  };

  const status = evaluateStatus(values, thresholds, faultMap);
  const paramLevel = status.paramLevel;
  const overallMeta = STATUS_META[status.level];
  const isDanger = status.level === 3;
  const riskScore = computeRiskScore(values, thresholds, faultMap);
  const bucket = riskBucket(riskScore);

  // ------------------------------------------------------------
  // 시계 갱신 (1초마다)
  // ------------------------------------------------------------
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ------------------------------------------------------------
  // ⑥ 마지막 정상 상태 시각 갱신: 시스템이 level 0(정상)일 때마다 매초 최신 시각으로 갱신하고,
  // 위험/주의/경고 상태에서는 갱신을 멈춰 "마지막으로 정상이었던 시각"을 그대로 유지한다.
  // ------------------------------------------------------------
  useEffect(() => {
    if (status.level === 0) {
      setLastNormalTime(nowStr());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // ------------------------------------------------------------
  // 정상 지터: 시나리오 전환 중이 아니고, 하드웨어 연동 모드가 꺼져 있을 때만
  // 베이스라인 근처에서 매초 미세하게 변동시킨다. (hwMode가 켜지면 아래 하드웨어 폴링 효과가
  // values를 직접 갱신하므로 이 지터는 완전히 멈춰야 한다.)
  // ------------------------------------------------------------
  useEffect(() => {
    const id = setInterval(() => {
      if (isTransitioning || hwMode) return;
      setValues(() => ({
        inTemp: jitter(baseline.inTemp, 0.35),
        outTemp: jitter(baseline.outTemp, 0.35),
        inFlow: Math.max(0, jitter(baseline.inFlow, 0.18)),
        outFlow: Math.max(0, jitter(baseline.outFlow, 0.18)),
        pressure: jitter(baseline.pressure, 4),
        flame: Math.max(0, Math.min(100, jitter(baseline.flame, baseline.flame > 50 ? 6 : 1.5))),
      }));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [baseline, isTransitioning, hwMode]);

  // ------------------------------------------------------------
  // 실시간 하드웨어 폴링: hwMode가 켜져 있을 때 1초마다 /api/sensors를 조회해
  // ESP32가 전송한 최신 값으로 values를 직접 갱신한다.
  // 응답이 5초 이상 갱신되지 않았거나 요청이 실패하면 hwOnline을 false로 표시만 하고,
  // (판단 로직이 이상한 값으로 흔들리지 않도록) 화면에는 마지막으로 받은 값을 그대로 유지한다.
  // ------------------------------------------------------------
  useEffect(() => {
    if (!hwMode) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/sensors");
        const data = await res.json();
        if (cancelled) return;
        if (data.online && data.values) {
          setValues({
            inTemp: data.values.inTemp,
            outTemp: data.values.outTemp,
            inFlow: data.values.inFlow,
            outFlow: data.values.outFlow,
            pressure: data.values.pressure,
            flame: data.values.flame,
          });
          setHwOnline(true);
          setHwLastSeen(data.lastSeen);
        } else {
          setHwOnline(false);
        }
      } catch (e) {
        if (!cancelled) setHwOnline(false);
      }
    };

    poll();
    const id = setInterval(poll, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hwMode]);

  // ------------------------------------------------------------
  // 차트/예측용 히스토리 누적: 매초 새 포인트를 추가한다.
  // t는 모니터링 시작(0초)부터 계속 증가하는 "경과 시간"이며, 최대 MAX_CHART_HISTORY개
  // (5분)까지 쌓이면 그 이후부터는 가장 오래된 포인트를 밀어낸다.
  //
  // 문제점 수정: 이전에는 이 effect가 [values]에 의존하고 있어서, values가 바뀔 때마다
  // (=거의 매초) setInterval이 clearInterval → 새로 시작을 반복했다. 이때 두 타이머(정상
  // 지터가 values를 갱신하는 타이머와, 이 히스토리 기록 타이머)의 시작 시점이 미묘하게
  // 어긋나면 1000ms를 채우기 직전에 계속 리셋되어 버려서, 실제 기록 주기가 1초가 아니라
  // 훨씬 느리게(체감상 10초에 한 번꼴로) 밀리는 문제가 있었다. 이제는 effect를 [](최초 1회)로만
  // 생성하고, 콜백 안에서는 valuesRef.current로 항상 최신 값을 읽어서 타이머 자체는 절대
  // 재시작되지 않게 했다.
  // ------------------------------------------------------------
  useEffect(() => {
    const id = setInterval(() => {
      const v = valuesRef.current;
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            t: tickCounter.current++,
            inTemp: Number(v.inTemp.toFixed(2)),
            outTemp: Number(v.outTemp.toFixed(2)),
            inFlow: Number(v.inFlow.toFixed(2)),
            outFlow: Number(v.outFlow.toFixed(2)),
            pressure: Number(v.pressure.toFixed(1)),
            flame: Number(v.flame.toFixed(1)),
          },
        ];
        return next.length > MAX_CHART_HISTORY ? next.slice(next.length - MAX_CHART_HISTORY) : next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------
  // 사고 이력 기록 + SOP 팝업 큐 등록: 새로운 위험 코드가 "새로 감지"될 때만 실행된다.
  // (기존에 이미 활성 상태였던 코드가 계속 유지되는 동안에는 재등록하지 않음 → 팝업 중복 방지)
  //
  // 문제점 수정: 센서값이 임계값 바로 근처에서 정상 지터(노이즈)로 흔들리면, 위험→정상→위험이
  // 몇 초 간격으로 반복되면서 매번 "새로운 사고"로 잘못 잡혀 사고 이력에 같은 사고가 계속
  // 중복 생성되는 문제가 있었다. 이제 같은 코드에 대해 REPEAT_SUPPRESS_MS(8초) 이내에
  // 이미 사고를 생성한 적이 있으면, 잠깐의 깜빡임으로 보고 새로 생성하지 않는다.
  // 이력은 MAX_INCIDENT_HISTORY 건으로 잘라 무한정 누적되지 않도록 한다.
  // ------------------------------------------------------------
  useEffect(() => {
    const currentCodes = new Set(status.dangerMessages.map((m) => m.code));
    status.dangerMessages.forEach((m) => {
      if (!lastDangerCodes.current.has(m.code)) {
        const now = Date.now();
        const lastAt = lastIncidentAtByCode.current[m.code] || 0;
        if (now - lastAt < REPEAT_SUPPRESS_MS) {
          return; // 최근 깜빡임으로 판단, 새 사고를 만들지 않음
        }
        lastIncidentAtByCode.current[m.code] = now;

        incidentSeq.current += 1;
        const id = `INC-${incidentSeq.current}-${m.code}`;
        const incident = {
          id,
          code: m.code,
          time: nowStr(),
          tick: tickCounter.current,
          text: m.text,
          refBadges: getRefBadges(m.code, values, thresholds),
          resolved: false,
          resolvedTime: null,
          acknowledged: false,
          ackTime: null,
        };
        setIncidents((prev) => [incident, ...prev].slice(0, MAX_INCIDENT_HISTORY));
        // 큐에 넣을 때 우선순위(PRIORITY_ORDER)순으로 정렬해, 나중에 들어와도
        // 더 급한 사고(화염감지 등)의 SOP가 먼저 뜨도록 한다.
        setSopQueue((prev) => [...prev, { id, priority: PRIORITY_ORDER[m.code] }].sort((a, b) => a.priority - b.priority));
      }
    });
    lastDangerCodes.current = currentCodes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.dangerMessages.map((m) => m.code).join(",")]);

  // ------------------------------------------------------------
  // SOP 팝업 큐 처리: 팝업이 닫혀 있고 대기열이 있으면 우선순위가 가장 높은 항목을 표시한다.
  // 이미 인지 완료(acknowledged)된 사고는 건너뛴다.
  // ------------------------------------------------------------
  useEffect(() => {
    if (!activeSop && sopQueue.length > 0) {
      const nextId = sopQueue[0].id;
      const found = incidents.find((i) => i.id === nextId);
      if (found && !found.acknowledged) {
        setActiveSop(found);
      }
      setSopQueue((prev) => prev.slice(1));
    }
  }, [sopQueue, activeSop, incidents]);

  const confirmSop = useCallback(() => {
    if (!activeSop) return;
    const t = nowStr();
    setIncidents((prev) => prev.map((i) => (i.id === activeSop.id ? { ...i, resolved: true, resolvedTime: t, acknowledged: true, ackTime: t } : i)));
    setActiveSop(null);
  }, [activeSop]);

  // ① 사고 이력 탭에서 개별 인지 완료 처리 — 대기 중이거나 표시 중인 같은 사고의
  // SOP 팝업을 즉시 제거해 재출력을 막는다. (새로운 사고 코드가 나중에 다시 감지되면
  // 위쪽 useEffect가 새 id로 다시 큐에 등록하므로 그 경우엔 정상적으로 팝업이 다시 뜬다.)
  const acknowledgeIncident = useCallback((id) => {
    const t = nowStr();
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, acknowledged: true, ackTime: t } : i)));
    setActiveSop((prev) => (prev && prev.id === id ? null : prev));
    setSopQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  // ------------------------------------------------------------
  // 시나리오 전환: 5초에 걸쳐 현재값 → 목표값으로 서서히 보간(이징 적용)
  // ------------------------------------------------------------
  const runScenario = useCallback(
    (key) => {
      if (transitionRef.current) clearInterval(transitionRef.current);
      setActiveScenario(key);
      const target = SCENARIOS[key].target;
      const start = { ...values };
      const startTime = Date.now();

      setIsTransitioning(true);
      transitionRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(1, elapsed / TRANSITION_MS);
        const eased = easeInOutCubic(t);

        setValues({
          inTemp: lerp(start.inTemp, target.inTemp, eased),
          outTemp: lerp(start.outTemp, target.outTemp, eased),
          inFlow: lerp(start.inFlow, target.inFlow, eased),
          outFlow: lerp(start.outFlow, target.outFlow, eased),
          pressure: lerp(start.pressure, target.pressure, eased),
          flame: lerp(start.flame, target.flame, eased),
        });

        if (t >= 1) {
          clearInterval(transitionRef.current);
          transitionRef.current = null;
          setBaseline({ ...target });
          setIsTransitioning(false);
        }
      }, TRANSITION_STEP_MS);
    },
    [values]
  );

  useEffect(() => {
    return () => {
      if (transitionRef.current) clearInterval(transitionRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ③ 임계값 저장: 저장 전 validateThresholds로 검증한다.
  // 검증 실패 시(하한≥상한, 빈 값 등) 적용하지 않고 에러 메시지만 표시한다.
  const saveThresholds = useCallback(() => {
    const { valid, errors } = validateThresholds(draftThresholds);
    if (!valid) {
      setValidationErrors(errors);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ type: "error", message: "⚠ 입력값을 확인해주세요 — 적용되지 않았습니다" });
      toastTimerRef.current = setTimeout(() => setToast(null), 3000);
      return;
    }
    setValidationErrors([]);
    setThresholds({ ...draftThresholds });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type: "success", message: `✅ ${nowStr()} 임계값이 적용되었습니다` });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, [draftThresholds]);

  const resetThresholds = useCallback(() => {
    setValidationErrors([]);
    setDraftThresholds({ ...DEFAULT_THRESHOLDS });
    setThresholds({ ...DEFAULT_THRESHOLDS });
  }, []);

  // ------------------------------------------------------------
  // AI 고장 예측: 최근 10개 포인트의 선형회귀 기울기로 위험 임계값 도달 시간을 예측한다.
  // 센서 오류(fault) 항목은 예측에서 제외한다.
  // ------------------------------------------------------------
  const predictions = useMemo(() => {
    const N = Math.min(10, history.length);
    const recent = history.slice(-N);
    const get = (key) => recent.map((r) => r[key]);

    const rows = [
      { key: "inTemp", already: paramLevel.inTemp === 3, fault: faultMap.inTemp, slope: linRegSlope(get("inTemp")) },
      { key: "outTemp", already: paramLevel.outTemp === 3, fault: faultMap.outTemp, slope: linRegSlope(get("outTemp")) },
      { key: "inFlow", already: paramLevel.inFlow === 3, fault: faultMap.inFlow, slope: linRegSlope(get("inFlow")) },
      { key: "outFlow", already: paramLevel.outFlow === 3, fault: faultMap.outFlow, slope: linRegSlope(get("outFlow")) },
      { key: "pressure", already: paramLevel.pressure === 3, fault: faultMap.pressure, slope: linRegSlope(get("pressure")) },
      { key: "flame", already: paramLevel.flame === 3, fault: faultMap.flame, slope: linRegSlope(get("flame")) },
    ].map((r) => {
      if (r.fault) return { ...r, ticks: Infinity, minutes: Infinity };
      let ticks;
      // minSlope: 정상 지터(노이즈) 폭의 절반 정도로 설정해, 값이 단순히 미세하게
      // 흔들리는 것만으로 회귀 기울기가 우연히 0이 아니게 나와도 "추세"로 오판하지 않게 한다.
      if (r.key === "inTemp" || r.key === "outTemp") {
        const { min, max } = thresholds[r.key];
        const nominal = (min + max) / 2;
        const rangeHalf = (max - min) / 2 || 1;
        ticks = ticksToDeviationThreshold(values[r.key], r.slope, nominal, rangeHalf * 3, 0.15);
      } else if (r.key === "inFlow" || r.key === "outFlow") {
        const nominal = nominalOf(r.key, thresholds) || 1;
        ticks = ticksToLowerThreshold(values[r.key], r.slope, nominal * 0.7, 0.07);
      } else if (r.key === "pressure") {
        const { min, max } = thresholds.pressure;
        ticks = ticksToUpperThreshold(values.pressure, r.slope, max + (max - min) * 0.5, 1.8);
      } else {
        ticks = ticksToUpperThreshold(values.flame, r.slope, thresholds.flame.max * 6, 2.5);
      }
      return { ...r, ticks, minutes: r.already ? 0 : ticks === Infinity ? Infinity : ticks / 60 };
    });

    rows.sort((a, b) => a.minutes - b.minutes);
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, values, thresholds, faultMap, paramLevel]);

  const validPredictions = predictions.filter((p) => !p.fault);
  const topPrediction = validPredictions[0];
  const hasWarningTrend = topPrediction && topPrediction.minutes !== Infinity;

  const unresolvedCount = incidents.filter((i) => !i.resolved).length;
  const resolvedCount = incidents.filter((i) => i.resolved).length;

  return (
    <div
      className="min-h-screen w-full font-sans relative"
      style={{
        background: COLORS.bg,
        color: COLORS.textPrimary,
        boxShadow: isDanger ? `inset 0 0 0 4px ${COLORS.danger}` : "inset 0 0 0 1px transparent",
        animation: isDanger ? "scada-danger-blink 1s ease-in-out infinite" : "none",
      }}
    >
      <SopModal incident={activeSop} onConfirm={confirmSop} />
      <Toast toast={toast} />

      {/* ============================================================
          상단 고정 헤더: 시스템 배너 + 탭 네비게이션
      ============================================================ */}
      <header className="w-full sticky top-0 z-40" style={{ background: COLORS.panel, borderBottom: `1px solid ${COLORS.panelBorder}` }}>
        <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: "#eff6ff", border: `1px solid ${COLORS.panelBorderLit}` }}>
              <Activity size={20} style={{ color: COLORS.cyan }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide" style={{ color: COLORS.textPrimary }}>
                열교환기 통합 안전 검지 시스템{" "}
                <span className="font-mono text-xs" style={{ color: COLORS.textDim }}>
                  HEX-SCADA v3.1
                </span>
              </h1>
              <p className="text-[11px] font-mono" style={{ color: COLORS.textDim }}>
                {now.toLocaleDateString("ko-KR")} {now.toLocaleTimeString("ko-KR", { hour12: false })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-[11px] font-mono px-3 py-1.5 rounded-md" style={{ border: `1px solid ${COLORS.panelBorder}`, color: COLORS.textDim }}>
              마지막 정상 확인: <span style={{ color: COLORS.normal }}>{lastNormalTime}</span>
            </div>

            {hwMode && (
              <div
                className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-md"
                style={{ border: `1px solid ${hwOnline ? COLORS.normal : COLORS.danger}55`, color: hwOnline ? COLORS.normal : COLORS.danger }}
              >
                {hwOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                {hwOnline ? "ESP32 연결됨" : "ESP32 연결 끊김"}
              </div>
            )}

            <div
              className="flex items-center gap-2 px-4 py-2 rounded-md"
              style={{ background: `${overallMeta.color}14`, border: `1px solid ${overallMeta.color}55`, boxShadow: isDanger ? overallMeta.glow : "none" }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: overallMeta.color, animation: isDanger ? "scada-pulse-dot 0.8s ease-in-out infinite" : "none" }} />
              <span className="text-xs font-mono" style={{ color: COLORS.textDim }}>
                시스템 상태
              </span>
              <span className="text-sm font-bold" style={{ color: overallMeta.color }}>
                {overallMeta.label}
              </span>
            </div>

            <div className="text-[10px] px-2.5 py-1.5 rounded-md text-right leading-tight" style={{ border: `1px solid ${COLORS.panelBorderLit}`, color: COLORS.textDim }}>
              <div style={{ color: COLORS.cyan }}>AI × 산업혁신</div>
              <div>여수석유화학고등학교</div>
            </div>
          </div>
        </div>

        <nav className="flex px-5 gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const isRiskHot = tab.key === "risk" && riskScore >= 61;
            const badgeCount = tab.key === "history" ? incidents.length : 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2.5 text-sm flex items-center gap-1.5 whitespace-nowrap transition-colors"
                style={{
                  color: isActive ? COLORS.cyan : isRiskHot ? COLORS.danger : COLORS.textDim,
                  borderBottom: isActive ? `2px solid ${COLORS.cyan}` : "2px solid transparent",
                  background: isActive ? "rgba(14,165,233,0.08)" : "transparent",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                {isRiskHot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.danger }} />}
                {badgeCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: COLORS.danger, color: "#ffffff" }}>
                    🔴{badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* 위험 시 원인 진단 배너 — 우선순위 정렬은 evaluateStatus에서 이미 처리됨 */}
      {isDanger && activeTab === "monitor" && (
        <div className="w-full px-5 py-2.5 flex flex-col gap-1" style={{ background: "rgba(220,38,38,0.08)", borderBottom: `1px solid ${COLORS.danger}55` }}>
          {status.dangerMessages.map((m, idx) => (
            <div key={m.code} className="flex items-center gap-2 text-sm font-mono" style={{ color: "#991b1b" }}>
              {idx === 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: COLORS.danger, color: "#ffffff" }}>
                  🚨 1순위 대응
                </span>
              )}
              {m.text}
            </div>
          ))}
        </div>
      )}

      <main key={activeTab} className="p-5 flex flex-col gap-5" style={{ animation: "tabFadeIn 0.35s ease" }}>
        {activeTab === "monitor" && (
          <MonitorTab
            values={values}
            paramLevel={paramLevel}
            faultMap={faultMap}
            thresholds={thresholds}
            history={history}
            activeScenario={activeScenario}
            isTransitioning={isTransitioning}
            runScenario={runScenario}
            incidents={incidents}
            hwMode={hwMode}
          />
        )}
        {activeTab === "risk" && (
          <RiskTab riskScore={riskScore} bucket={bucket} predictions={predictions} topPrediction={topPrediction} hasWarningTrend={hasWarningTrend} paramLevel={paramLevel} faultMap={faultMap} />
        )}
        {activeTab === "diagram" && <DiagramTab paramLevel={paramLevel} dangerCodes={status.dangerMessages.map((m) => m.code)} />}
        {activeTab === "history" && (
          <HistoryTab incidents={incidents} unresolvedCount={unresolvedCount} resolvedCount={resolvedCount} onAcknowledge={acknowledgeIncident} />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            draftThresholds={draftThresholds}
            setDraftThresholds={setDraftThresholds}
            onSave={saveThresholds}
            onReset={resetThresholds}
            validationErrors={validationErrors}
            hwMode={hwMode}
            setHwMode={setHwMode}
            hwOnline={hwOnline}
            hwLastSeen={hwLastSeen}
          />
        )}
      </main>

      <footer className="w-full px-5 py-3 text-center text-[11px] font-mono" style={{ borderTop: `1px solid ${COLORS.panelBorder}`, color: COLORS.textDim }}>
        본 시스템은 바이브 코딩(AI 보조 코딩) 기법으로 구현되었습니다 · 여수석유화학고등학교 × 제4회 NAVER OGQ마켓 AI Competition
      </footer>
    </div>
  );
}
