import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Activity, Wifi, WifiOff, Sun, Moon, Volume2, VolumeX } from "lucide-react";
import { initAlertSound, playAlertSound } from "./utils/alertSound";
import "./styles/scada.css";
import { LOCALES, translate } from "./data/i18n";

// 상태 레벨(0~3) → i18n 키 매핑
const STATUS_KEYS = ["status_normal", "status_caution", "status_warning", "status_danger"];

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
  normalizeThresholds,
  scaleToThresholds,
  jitterMagnitudes,
} from "./utils/calculations";

import SopModal from "./components/SopModal";
import Toast from "./components/Toast";
import MonitorTab from "./tabs/MonitorTab";
import RiskTab from "./tabs/RiskTab";
import DiagramTab from "./tabs/DiagramTab";
import HistoryTab from "./tabs/HistoryTab";
import ManualTab from "./tabs/ManualTab";
import SettingsTab from "./tabs/SettingsTab";

// 브라우저 저장소 읽기/쓰기. 저장이 막힌 환경(시크릿 창, 미리보기 등)에서는 기본값으로 동작한다.
function readPref(key, fallback) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 저장 실패는 무시: 화면 동작에는 영향 없음 */
  }
}

// 다른 사람이 바꾼 임계값을 서버에서 받아오는 간격 (밀리초)
const THRESHOLD_SYNC_MS = 5000;

// 설정 비밀번호(SETTINGS_PIN)는 탭을 닫을 때까지만 기억한다.
function readSessionPin() {
  try {
    return window.sessionStorage.getItem("hex-scada-settings-pin") || "";
  } catch {
    return "";
  }
}
function writeSessionPin(pin) {
  try {
    window.sessionStorage.setItem("hex-scada-settings-pin", pin);
  } catch {
    /* 저장 실패는 무시 */
  }
}

// 경고 팝업이 떠 있는 동안 경보음을 반복하는 간격 (밀리초). 더 자주/드물게 울리게 하려면 이 값만 바꾸면 된다.
const SOP_ALARM_INTERVAL_MS = 2000;

export default function HeatExchangerSCADA() {
  const [values, setValues] = useState({ ...NORMAL_BASELINE });
  const [baseline, setBaseline] = useState({ ...NORMAL_BASELINE });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeScenario, setActiveScenario] = useState("normal");
  const [history, setHistory] = useState(() => [{ t: 0, ...NORMAL_BASELINE }]);
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState("monitor");
  const [lastNormalTime, setLastNormalTime] = useState(() => nowStr());

  // 다국어 지원: 기본 한국어, 영어/베트남어 전환 가능
  const [locale, setLocale] = useState("ko");

  // ---- 화면 표시 설정 (사용자별 편의 기능) ----
  // theme: "light"(기본, 밝은 화면) / "dark"(처음 버전의 어두운 SCADA 화면)
  // largeView: 센서 값 숫자를 크게 키워 멀리서도 읽을 수 있게 하는 모드
  // 두 값 모두 브라우저에 저장해 새로고침해도 유지한다. (시크릿 창 등 저장이 막힌 환경에서도 앱이 죽지 않도록 try/catch)
  const [theme, setTheme] = useState(() => readPref("hex-scada-theme", "light"));
  const [largeView, setLargeView] = useState(() => readPref("hex-scada-large-view", "off") === "on");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writePref("hex-scada-theme", theme);
  }, [theme]);
  useEffect(() => {
    writePref("hex-scada-large-view", largeView ? "on" : "off");
  }, [largeView]);
  const t = useCallback((key, params) => translate(locale, key, params), [locale]);

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

  // 경보음 음소거 토글 — 로컬 state로만 유지 (영속 저장 불필요)
  const [soundMuted, setSoundMuted] = useState(false);
  const soundMutedRef = useRef(soundMuted); // setInterval 클로저에서 최신 값을 읽기 위한 ref
  soundMutedRef.current = soundMuted;

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
    inPressure: isSensorFault("inPressure", values.inPressure, thresholds),
    outPressure: isSensorFault("outPressure", values.outPressure, thresholds),
  };

  const status = evaluateStatus(values, thresholds, faultMap);
  const paramLevel = status.paramLevel;
  const overallMeta = STATUS_META[status.level];
  const isDanger = status.level === 3;
  const riskScore = computeRiskScore(values, thresholds, faultMap);
  const bucket = riskBucket(riskScore);

  // ------------------------------------------------------------
  // 경고음 unlock 준비: 브라우저 자동재생 정책 때문에 사용자의 첫 클릭/터치/키 입력이
  // 있기 전까지는 소리를 재생할 수 없다. 마운트 시 1회 리스너를 등록해두면
  // 첫 상호작용 이후부터 playAlertSound()가 정상적으로 소리를 낸다.
  // ------------------------------------------------------------
  useEffect(() => {
    initAlertSound();
  }, []);

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
      const mag = jitterMagnitudes(thresholds); // 흔들림 폭도 현재 정상 범위 크기에 비례
      setValues(() => ({
        inTemp: jitter(baseline.inTemp, mag.inTemp),
        outTemp: jitter(baseline.outTemp, mag.outTemp),
        inFlow: Math.max(0, jitter(baseline.inFlow, mag.inFlow)),
        outFlow: Math.max(0, jitter(baseline.outFlow, mag.outFlow)),
        inPressure: Math.max(0, jitter(baseline.inPressure, mag.inPressure)),
        outPressure: Math.max(0, jitter(baseline.outPressure, mag.outPressure)),
      }));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [baseline, isTransitioning, hwMode, thresholds]);

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
            // 예전 펌웨어(압력 1개, "pressure")가 보내는 값도 받아서 입구·출구 압력 둘 다에 쓴다
            inPressure: data.values.inPressure ?? data.values.pressure,
            outPressure: data.values.outPressure ?? data.values.pressure,
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
            inPressure: Number(v.inPressure.toFixed(1)),
            outPressure: Number(v.outPressure.toFixed(1)),
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
        // 더 급한 사고(과압 등)의 SOP가 먼저 뜨도록 한다.
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

  // ------------------------------------------------------------
  // SOP 팝업 경보음: 팝업(경고 메시지 + 매뉴얼)이 열리면 바로 울리고,
  // [조치 완료]를 눌러 팝업이 닫힐 때까지 SOP_ALARM_INTERVAL_MS 간격으로 계속 반복한다.
  // 음소거 버튼을 누르면 반복 중에도 즉시 조용해진다 (soundMutedRef로 최신 값 확인).
  // ------------------------------------------------------------
  useEffect(() => {
    if (!activeSop) return;
    playAlertSound({ muted: soundMutedRef.current });
    const id = setInterval(() => {
      playAlertSound({ muted: soundMutedRef.current });
    }, SOP_ALARM_INTERVAL_MS);
    return () => clearInterval(id);
  }, [activeSop]);

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
      // 시나리오 목표값을 현재 정상 범위에 맞게 환산 (실제 장비 기준으로 바꿔도 시나리오가 똑같이 재현됨)
      const target = scaleToThresholds(SCENARIOS[key].target, thresholdsRef.current);
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
          inPressure: lerp(start.inPressure, target.inPressure, eased),
          outPressure: lerp(start.outPressure, target.outPressure, eased),
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
  const showToast = useCallback((type, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ------------------------------------------------------------
  // 임계값 공유: 한 사람이 설정 탭에서 저장한 임계값을 서버(/api/thresholds → Redis)에 올리고,
  // 모든 접속자가 THRESHOLD_SYNC_MS마다 서버 값을 받아와 같은 기준으로 판단하게 한다.
  // 서버가 없는 환경(npm run dev 로컬 실행 등)에서는 예전처럼 이 화면에만 적용된다.
  // ------------------------------------------------------------
  const sharedThresholdsRef = useRef(false); // 서버 저장소를 쓸 수 있는지
  // 마지막으로 반영한 서버 저장 시각. 서버 응답은 CDN에 2초 캐시되므로, 방금 저장한 값보다
  // 오래된 응답이 와도 예전 값으로 되돌아가지 않도록 이 시각보다 오래된 값은 무시한다.
  const thresholdsUpdatedAtRef = useRef(0);
  const thresholdsRef = useRef(thresholds);
  thresholdsRef.current = thresholds;
  const draftThresholdsRef = useRef(draftThresholds);
  draftThresholdsRef.current = draftThresholds;

  // 임계값이 바뀌는 바로 그 순간에 시뮬레이션 기준값도 새 정상 범위로 옮긴다.
  // (setThresholds와 같은 업데이트 안에서 처리 → 접속 직후 "예전 기준값 × 새 임계값"이 한 번이라도
  //  겹쳐 가짜 위험·사고 이력·경보음이 생기는 것을 막는다.)
  // 하드웨어 모드이거나 시나리오가 진행 중이면 실제 값/진행 중인 시나리오를 건드리지 않는다.
  const simStateRef = useRef({ hwMode, isTransitioning, activeScenario });
  simStateRef.current = { hwMode, isTransitioning, activeScenario };
  const rebaseSimulation = useCallback((next) => {
    const { hwMode: hw, isTransitioning: moving, activeScenario: scenario } = simStateRef.current;
    if (hw || moving) return;
    const base = scaleToThresholds((SCENARIOS[scenario] || SCENARIOS.normal).target, next);
    setBaseline(base);
    setValues(base);
    // 예전 기준의 차트·예측 기록이 남아 있으면 큰 값 점프가 "급변 추세"로 잘못 예측되므로 새로 시작
    setHistory([{ t: tickCounter.current++, ...base }]);
  }, []);

  const applyServerThresholds = useCallback((raw) => {
    // 예전 형식(압력 1개)으로 저장된 값도 현재 센서 구성(입구·출구 압력)에 맞게 정리
    const next = normalizeThresholds(raw);
    const current = thresholdsRef.current;
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    // 설정 탭에서 값을 고치는 중(입력값 ≠ 적용값)이면 입력 중인 값은 건드리지 않는다.
    if (JSON.stringify(draftThresholdsRef.current) === JSON.stringify(current)) {
      setDraftThresholds({ ...next });
    }
    setThresholds({ ...next });
    rebaseSimulation(next);
  }, [rebaseSimulation]);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const res = await fetch("/api/thresholds");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        sharedThresholdsRef.current = true;
        if (data.thresholds && (data.updatedAt || 0) >= thresholdsUpdatedAtRef.current) {
          thresholdsUpdatedAtRef.current = data.updatedAt || 0;
          applyServerThresholds(data.thresholds);
        }
      } catch {
        // 서버 연결 실패: 마지막으로 받은 값을 그대로 유지한다.
      }
    };
    sync();
    const id = setInterval(sync, THRESHOLD_SYNC_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [applyServerThresholds]);

  // 서버에 저장. 성공하면 true. SETTINGS_PIN이 걸려 있으면 비밀번호를 물어본다.
  const saveSharedThresholds = useCallback(
    async (next) => {
      const post = (pin) =>
        fetch("/api/thresholds", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(pin ? { "x-settings-pin": pin } : {}) },
          body: JSON.stringify({ thresholds: next }),
        });
      try {
        let pin = readSessionPin();
        let res = await post(pin);
        if (res.status === 401) {
          pin = window.prompt(t("settings_pin_prompt")) || "";
          if (!pin) return false;
          res = await post(pin);
          if (res.status === 401) {
            showToast("error", t("toast_pin_wrong"));
            return false;
          }
          writeSessionPin(pin);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const saved = await res.json().catch(() => ({}));
        if (saved.updatedAt) thresholdsUpdatedAtRef.current = saved.updatedAt;
        return true;
      } catch {
        showToast("error", t("toast_share_failed"));
        return false;
      }
    },
    [t, showToast]
  );

  const applyThresholds = useCallback(
    async (next) => {
      if (sharedThresholdsRef.current) {
        const ok = await saveSharedThresholds(next);
        if (!ok) return;
      }
      setValidationErrors([]);
      setThresholds({ ...next });
      setDraftThresholds({ ...next });
      rebaseSimulation(next);
      showToast("success", t(sharedThresholdsRef.current ? "toast_applied_shared" : "toast_applied", { time: nowStr() }));
    },
    [saveSharedThresholds, showToast, t, rebaseSimulation]
  );

  const saveThresholds = useCallback(() => {
    const { valid, errors } = validateThresholds(draftThresholds);
    if (!valid) {
      setValidationErrors(errors);
      showToast("error", t("toast_invalid"));
      return;
    }
    applyThresholds(draftThresholds);
  }, [draftThresholds, applyThresholds, showToast, t]);

  const resetThresholds = useCallback(() => {
    applyThresholds({ ...DEFAULT_THRESHOLDS });
  }, [applyThresholds]);

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
      { key: "inPressure", already: paramLevel.inPressure === 3, fault: faultMap.inPressure, slope: linRegSlope(get("inPressure")) },
      { key: "outPressure", already: paramLevel.outPressure === 3, fault: faultMap.outPressure, slope: linRegSlope(get("outPressure")) },
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
      } else {
        // 입구·출구 압력: 위험 상한(상한 + 정상폭의 50%)까지 남은 시간
        const { min, max } = thresholds[r.key];
        ticks = ticksToUpperThreshold(values[r.key], r.slope, max + (max - min) * 0.5, 1.8);
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
      <SopModal incident={activeSop} onConfirm={confirmSop} t={t} />
      <Toast toast={toast} />

      {/* ============================================================
          상단 고정 헤더: 시스템 배너 + 탭 네비게이션
      ============================================================ */}
      <header className="w-full sticky top-0 z-40" style={{ background: COLORS.panel, borderBottom: `1px solid ${COLORS.panelBorder}` }}>
        <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: COLORS.accentSoft, border: `1px solid ${COLORS.panelBorderLit}` }}>
              <Activity size={20} style={{ color: COLORS.cyan }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide" style={{ color: COLORS.textPrimary }}>
                {t("app_title")}{" "}
                <span className="font-mono text-xs" style={{ color: COLORS.textDim }}>
                  HEX-SCADA v3.1
                </span>
              </h1>
              <p className="text-[11px] font-mono" style={{ color: COLORS.textDim }}>
                {now.toLocaleDateString("ko-KR")} {now.toLocaleTimeString("ko-KR", { hour12: false })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* 화면 테마 전환: 라이트 / 다크 */}
            <div className="flex items-center rounded-md overflow-hidden" style={{ border: `1px solid ${COLORS.panelBorderLit}` }} title={t("theme_toggle_title")}>
              {[
                { code: "light", Icon: Sun },
                { code: "dark", Icon: Moon },
              ].map(({ code, Icon }) => (
                <button
                  key={code}
                  onClick={() => setTheme(code)}
                  aria-pressed={theme === code}
                  className="text-[11px] font-mono px-2.5 py-1.5 flex items-center gap-1"
                  style={{
                    background: theme === code ? COLORS.cyan : "transparent",
                    color: theme === code ? "#ffffff" : COLORS.textDim,
                    fontWeight: theme === code ? 700 : 500,
                  }}
                >
                  <Icon size={12} />
                  {t(code === "light" ? "theme_light" : "theme_dark")}
                </button>
              ))}
            </div>

            {/* 다국어 전환: 한국어 / English / Tiếng Việt */}
            <div className="flex items-center rounded-md overflow-hidden" style={{ border: `1px solid ${COLORS.panelBorderLit}` }}>
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLocale(l.code)}
                  className="text-[11px] font-mono px-2.5 py-1.5"
                  style={{
                    background: locale === l.code ? COLORS.cyan : "transparent",
                    color: locale === l.code ? "#ffffff" : COLORS.textDim,
                    fontWeight: locale === l.code ? 700 : 500,
                  }}
                >
                  {l.code.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-mono px-3 py-1.5 rounded-md" style={{ border: `1px solid ${COLORS.panelBorder}`, color: COLORS.textDim }}>
              {t("last_normal_check")}: <span style={{ color: COLORS.normal }}>{lastNormalTime}</span>
            </div>

            {hwMode && (
              <div
                className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-md"
                style={{ border: `1px solid ${hwOnline ? COLORS.normal : COLORS.danger}55`, color: hwOnline ? COLORS.normal : COLORS.danger }}
              >
                {hwOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                {hwOnline ? t("esp32_connected") : t("esp32_disconnected")}
              </div>
            )}

            <button
              onClick={() => setSoundMuted((v) => !v)}
              title={soundMuted ? t("sound_unmute") : t("sound_mute")}
              aria-label={soundMuted ? t("sound_unmute") : t("sound_mute")}
              className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-md"
              style={{
                border: `1px solid ${soundMuted ? COLORS.danger + "55" : COLORS.panelBorderLit}`,
                color: soundMuted ? COLORS.danger : COLORS.textDim,
                background: "transparent",
              }}
            >
              {soundMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              {soundMuted ? t("sound_off") : t("sound_on")}
            </button>

            <div
              className="flex items-center gap-2 px-4 py-2 rounded-md"
              style={{ background: `${overallMeta.color}14`, border: `1px solid ${overallMeta.color}55`, boxShadow: isDanger ? overallMeta.glow : "none" }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: overallMeta.color, animation: isDanger ? "scada-pulse-dot 0.8s ease-in-out infinite" : "none" }} />
              <span className="text-xs font-mono" style={{ color: COLORS.textDim }}>
                {t("system_status")}
              </span>
              <span className="text-sm font-bold" style={{ color: overallMeta.color }}>
                {t(STATUS_KEYS[status.level])}
              </span>
            </div>

            <div className="text-[10px] px-2.5 py-1.5 rounded-md text-right leading-tight" style={{ border: `1px solid ${COLORS.panelBorderLit}`, color: COLORS.textDim }}>
              <div style={{ color: COLORS.cyan }}>{t("badge_track")}</div>
              <div>{t("badge_school")}</div>
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
                <span>{t(`tab_${tab.key}`)}</span>
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
            <div key={m.code} className="flex items-center gap-2 text-sm font-mono" style={{ color: COLORS.dangerText }}>
              {idx === 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: COLORS.danger, color: "#ffffff" }}>
                  {t("priority_badge")}
                </span>
              )}
              {t(`msg_${m.code}`)}
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
            largeView={largeView}
            setLargeView={setLargeView}
            t={t}
          />
        )}
        {activeTab === "risk" && (
          <RiskTab riskScore={riskScore} bucket={bucket} predictions={predictions} topPrediction={topPrediction} hasWarningTrend={hasWarningTrend} paramLevel={paramLevel} faultMap={faultMap} t={t} />
        )}
        {activeTab === "diagram" && <DiagramTab paramLevel={paramLevel} dangerCodes={status.dangerMessages.map((m) => m.code)} t={t} />}
        {activeTab === "history" && (
          <HistoryTab incidents={incidents} unresolvedCount={unresolvedCount} resolvedCount={resolvedCount} onAcknowledge={acknowledgeIncident} t={t} />
        )}
        {activeTab === "manual" && <ManualTab t={t} locale={locale} />}
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
            t={t}
          />
        )}
      </main>

      <footer className="w-full px-5 py-3 text-center text-[11px] font-mono" style={{ borderTop: `1px solid ${COLORS.panelBorder}`, color: COLORS.textDim }}>
        {t("footer_text")}
      </footer>
    </div>
  );
}
