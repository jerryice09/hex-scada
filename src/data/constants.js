// ============================================================
// constants.js
// 이 파일은 값을 "계산"하지 않고 순수 정적 데이터만 보관한다.
// (계산 로직은 src/utils/calculations.js 에 있음)
// ============================================================

// SCADA/HMI 밝은 톤 팔레트 (산업 안전표지 색 언어 기준: 스틸블루/그린/오렌지/레드)
export const COLORS = {
  bg: "#f8fafc",
  panel: "#ffffff",
  panelBorder: "#e2e8f0",
  panelBorderLit: "#cbd5e1",
  textPrimary: "#0f172a",
  textDim: "#64748b",
  cyan: "#0ea5e9",
  normal: "#16a34a",
  caution: "#ca8a04",
  warning: "#ea580c",
  danger: "#dc2626",
  fault: "#64748b",
};

// 상태 레벨(0~3) → 라벨/색상/발광 효과 매핑
export const STATUS_META = {
  0: { label: "정상", color: COLORS.normal, glow: "0 0 14px rgba(22,163,74,0.45)" },
  1: { label: "주의", color: COLORS.caution, glow: "0 0 14px rgba(202,138,4,0.45)" },
  2: { label: "경고", color: COLORS.warning, glow: "0 0 14px rgba(234,88,12,0.5)" },
  3: { label: "위험", color: COLORS.danger, glow: "0 0 18px rgba(220,38,38,0.6)" },
};

export const UNITS = { inTemp: "℃", outTemp: "℃", inFlow: "L/min", outFlow: "L/min", pressure: "kPa", flame: "%" };

export const SENSOR_LABELS = {
  inTemp: "입구 온도",
  outTemp: "출구 온도",
  inFlow: "입구 유량",
  outFlow: "출구 유량",
  pressure: "배관 압력",
  flame: "화염 감지",
};

// 여수석유화학고 실습 환경 기준 "정상 범위" 기본값
// → 설정(⚙) 탭에서 사용자가 즉시 변경 가능하며, 변경된 값은 App.jsx의 thresholds 상태로 관리된다.
// flame(화염 감지 강도, %)은 실제 화염 센서의 아날로그 출력을 0~100으로 정규화한 값을 기준으로 한다.
export const DEFAULT_THRESHOLDS = {
  inTemp: { min: 65, max: 75 },
  outTemp: { min: 30, max: 40 },
  inFlow: { min: 8, max: 12 },
  outFlow: { min: 8, max: 12 },
  pressure: { min: 200, max: 400 },
  flame: { min: 0, max: 15 },
};

// 센서 시뮬레이션(지터)이 흔들리는 중심값 — "정상 임계값"과는 별개의 개념이다.
// 임계값(DEFAULT_THRESHOLDS)을 바꿔도 시뮬레이션 베이스라인 자체는 바뀌지 않는다.
export const NORMAL_BASELINE = { inTemp: 70, outTemp: 35, inFlow: 10, outFlow: 10, pressure: 300, flame: 5 };

// 하드웨어적으로 "절대 나올 수 없는" 값의 최소 경계.
// 설정 탭에서 정상범위를 아무리 넓게 조정해도 이 절대값 아래로는 내려가지 않는다.
// (상한은 calculations.js의 getEffectiveFaultBounds에서 임계값에 비례해 동적으로 완충됨)
// flame은 0~100% 정규화 값이므로 물리적 상한 자체가 100이다.
export const FAULT_HARD_BOUNDS = {
  inTemp: { min: -10, max: 200 },
  outTemp: { min: -10, max: 200 },
  inFlow: { min: 0, max: 50 },
  outFlow: { min: 0, max: 50 },
  pressure: { min: 0, max: 1000 },
  flame: { min: 0, max: 100 },
};

// 시나리오 시뮬레이터가 5초에 걸쳐 도달시키는 목표값 프로파일
export const SCENARIOS = {
  normal: { label: "정상 운전", icon: "🟢", target: { ...NORMAL_BASELINE } },
  waterHammer: {
    label: "워터해머링",
    icon: "💧",
    target: { inTemp: 70, outTemp: 33, inFlow: 9.6, outFlow: 6.4, pressure: 470, flame: 6 },
  },
  fireDetected: {
    label: "화염 감지",
    icon: "🔥",
    // flame: 99 — 위험 기준(기본 임계값 15의 6배 = 90)보다 확실히 위에 두어, 정상 지터(±6)가
    // 섞여도 최솟값이 93으로 유지되게 함. 예전엔 95였는데 지터 폭(±6)과 겹쳐서 값이 89~90
    // 근처로 떨어질 때마다 "위험 해제→재발생"이 반복되며 사고 이력이 중복 생성되는 문제가 있었다.
    target: { inTemp: 78, outTemp: 42, inFlow: 9.8, outFlow: 9.7, pressure: 305, flame: 99 },
  },
  overPressure: {
    label: "과압 위험",
    icon: "💥",
    target: { inTemp: 71, outTemp: 36, inFlow: 7.4, outFlow: 9.5, pressure: 552, flame: 7 },
  },
  heatExchangeFault: {
    label: "열교환 이상",
    icon: "🌡",
    target: { inTemp: 51, outTemp: 53, inFlow: 9.7, outFlow: 9.6, pressure: 298, flame: 5 },
  },
};

// 시나리오 전환 시간(5초)과 보간 스텝 간격, 정상 지터 갱신 주기
export const TRANSITION_MS = 5000;
export const TRANSITION_STEP_MS = 100;
export const TICK_MS = 1000;
// 차트가 보관하는 최대 데이터 포인트 수 (1초당 1개 * 300 = 최근 5분).
// "전체" 보기에서 60초가 지나면 분 단위 눈금으로 자동 전환되고, "최근 20초" 확대 보기로
// 언제든 초 단위 상세 구간으로 전환할 수 있다.
export const MAX_CHART_HISTORY = 300;

// 위험 코드별 4단계 SOP 절차
export const SOP_STEPS = {
  WATER_HAMMER: {
    title: "워터해머링 대응 SOP",
    steps: ["출구 드레인 밸브 즉시 개방", "입구 증기 공급 50% 감소", "설비 담당자 즉시 연락", "배관 압력 정상화 확인 후 재가동"],
  },
  FIRE_DETECTED: {
    title: "화염 감지 대응 SOP",
    steps: ["해당 구역 즉시 대피", "소화기·소화전 위치 확인 및 초동 진화 준비", "가능하면 전원/공급 즉시 차단", "119 및 안전관리자 동시 연락"],
  },
  OVER_PRESSURE: {
    title: "과압 대응 SOP",
    steps: ["압력 릴리프 밸브 작동 확인", "공급 차단", "압력 강하 모니터링", "원인 파악 후 재기동 승인"],
  },
  HEAT_FAULT: {
    title: "열교환 이상 대응 SOP",
    steps: ["유량 밸브 점검", "튜브 내부 오염 여부 확인", "열교환 효율 재측정", "정비팀 투입"],
  },
};

export const CODE_LABELS = { WATER_HAMMER: "워터해머링", FIRE_DETECTED: "화염 감지", OVER_PRESSURE: "과압", HEAT_FAULT: "열교환 이상" };

// 인명피해 가능성 기준 다중 위험 우선순위 (숫자가 작을수록 먼저 대응)
export const PRIORITY_ORDER = { FIRE_DETECTED: 1, OVER_PRESSURE: 2, WATER_HAMMER: 3, HEAT_FAULT: 4 };

export const TABS = [
  { key: "monitor", label: "메인 모니터링", emoji: "🖥" },
  { key: "risk", label: "위험도 분석", emoji: "📊" },
  { key: "diagram", label: "설비 구조도", emoji: "🏭" },
  { key: "history", label: "사고 이력", emoji: "📋" },
  { key: "settings", label: "설정", emoji: "⚙" },
];

// 사고 이력에 보관하는 최대 건수 (무한 누적으로 인한 메모리 증가 방지)
export const MAX_INCIDENT_HISTORY = 300;
