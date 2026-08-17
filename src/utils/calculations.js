// ============================================================
// calculations.js
// 컴포넌트에 의존하지 않는 순수 함수만 모아둔다.
// (UI 상태 X, React Hook X → 이 파일만 따로 유닛 테스트하기 쉽게 하기 위함)
// ============================================================
import { FAULT_HARD_BOUNDS, PRIORITY_ORDER, COLORS } from "../data/constants";

// ------------------------------------------------------------
// 기본 수학/시간 유틸
// ------------------------------------------------------------
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const nowStr = () => new Date().toLocaleTimeString("ko-KR", { hour12: false });

// 베이스라인 근처에서 ±magnitude 범위로 흔드는 정상 지터 노이즈
export function jitter(value, magnitude) {
  return value + (Math.random() - 0.5) * 2 * magnitude;
}

export function fmt(n, digits = 1) {
  return Number(n).toFixed(digits);
}

// 최소자승법 기반 선형회귀 기울기 (AI 고장 예측 타이머에서 사용)
export function linRegSlope(ys) {
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// 편차 기반(온도) 임계값까지 남은 예상 초(틱) 계산. 추세가 임계값 방향이 아니면 Infinity 반환.
// minSlope: 이 값보다 기울기가 작으면 "추세 없음"으로 간주한다. 센서의 정상 지터(노이즈) 폭보다
// 충분히 커야, 단순히 값이 미세하게 흔들리는 것까지 "위험으로 가는 추세"로 오판하지 않는다.
export function ticksToDeviationThreshold(current, slope, nominal, thresholdDev, minSlope = 1e-4) {
  if (Math.abs(slope) < minSlope) return Infinity;
  const target = slope > 0 ? nominal + thresholdDev : nominal - thresholdDev;
  const ticks = (target - current) / slope;
  return ticks > 0 ? ticks : Infinity;
}
// 하한(유량 감소) 임계값까지 남은 예상 초 계산. 증가 추세면 Infinity.
export function ticksToLowerThreshold(current, slope, threshold, minSlope = 1e-4) {
  if (slope >= -minSlope) return Infinity;
  const ticks = (threshold - current) / slope;
  return ticks > 0 ? ticks : Infinity;
}
// 상한(압력·화염감지 상승) 임계값까지 남은 예상 초 계산. 감소 추세면 Infinity.
export function ticksToUpperThreshold(current, slope, threshold, minSlope = 1e-4) {
  if (slope <= minSlope) return Infinity;
  const ticks = (threshold - current) / slope;
  return ticks > 0 ? ticks : Infinity;
}

// ------------------------------------------------------------
// 센서 오류(SENSOR FAULT) 판정
// ------------------------------------------------------------
// 문제점 수정: 오류 판정 상한을 하드코딩된 값으로만 고정하면, 사용자가 설정 탭에서
// 정상 범위 상한을 크게 올렸을 때(예: 압력 900kPa 공정) 실제로는 정상값인데도
// FAULT로 오탐할 위험이 있다. 그래서 "물리적 절대 한계(FAULT_HARD_BOUNDS)"와
// "현재 임계값 상한의 1.5배" 중 더 큰 쪽을 실제 오류 판정 상한으로 사용한다.
// 기본 임계값(DEFAULT_THRESHOLDS)에서는 항상 FAULT_HARD_BOUNDS와 동일한 값이 나오도록
// 설계되어 있어 기존 동작과 100% 호환된다.
export function getEffectiveFaultBounds(key, thresholds) {
  const hard = FAULT_HARD_BOUNDS[key];
  const t = thresholds[key];
  const bufferedMax = t.max * 1.5;
  return { min: hard.min, max: Math.max(hard.max, bufferedMax) };
}

export function isSensorFault(key, value, thresholds) {
  const b = getEffectiveFaultBounds(key, thresholds);
  return value < b.min || value > b.max || Number.isNaN(value);
}

// ------------------------------------------------------------
// 임계값 기반 개별 센서 상태 판단 (0 정상 / 1 주의 / 2 경고 / 3 위험)
// ------------------------------------------------------------
export function calcParamLevel(key, value, thresholds) {
  const { min, max } = thresholds[key];

  if (key === "inTemp" || key === "outTemp") {
    const nominal = (min + max) / 2;
    const rangeHalf = (max - min) / 2 || 1;
    const dev = Math.abs(value - nominal);
    if (dev >= rangeHalf * 3) return 3;
    if (dev >= rangeHalf * 2) return 1;
    return 0;
  }
  if (key === "inFlow" || key === "outFlow") {
    const nominal = (min + max) / 2 || 1;
    const dropPct = ((nominal - value) / nominal) * 100;
    if (dropPct >= 30) return 3;
    if (dropPct >= 20) return 2;
    if (dropPct >= 10) return 1;
    return 0;
  }
  if (key === "pressure") {
    const dangerUpper = max + (max - min) * 0.5;
    if (value > dangerUpper) return 3;
    if (value >= max) return 2;
    if (value < min) return 1;
    return 0;
  }
  if (key === "flame") {
    if (value > max * 6) return 3;
    if (value > max * 3) return 2;
    if (value > max) return 1;
    return 0;
  }
  return 0;
}

export function nominalOf(key, thresholds) {
  const { min, max } = thresholds[key];
  return (min + max) / 2;
}

// ------------------------------------------------------------
// 종합 상태 판단: 센서 오류로 판정된 항목은 계산에서 제외(레벨 0으로 간주)
// ------------------------------------------------------------
export function evaluateStatus(values, thresholds, faultMap) {
  const level = (key) => (faultMap[key] ? 0 : calcParamLevel(key, values[key], thresholds));
  const paramLevel = {
    inTemp: level("inTemp"),
    outTemp: level("outTemp"),
    inFlow: level("inFlow"),
    outFlow: level("outFlow"),
    pressure: level("pressure"),
    flame: level("flame"),
  };

  const dangerMessages = [];
  if (paramLevel.outFlow === 3) {
    dangerMessages.push({ code: "WATER_HAMMER", text: "⚠ 응축수 축적 감지 — 워터해머링 발생 우려. 즉시 드레인 밸브 점검 요망" });
  }
  if (paramLevel.inTemp === 3 && paramLevel.outTemp === 3) {
    dangerMessages.push({ code: "HEAT_FAULT", text: "⚠ 열교환 이상 감지 — 누출 또는 내부 파손 가능성. 긴급 점검 필요" });
  }
  if (paramLevel.flame === 3) {
    dangerMessages.push({ code: "FIRE_DETECTED", text: "⚠ 화염 감지 — 화재 위험. 즉시 해당 구역 대피 및 초동 조치 필요" });
  }
  if (paramLevel.pressure === 3) {
    dangerMessages.push({ code: "OVER_PRESSURE", text: "⚠ 과압 감지 — 배관 파열 위험. 긴급 압력 릴리프 밸브 작동 확인" });
  }

  // 인명피해 가능성 기준 우선순위 정렬 (화염감지 > 과압 > 워터해머링 > 열교환이상)
  dangerMessages.sort((a, b) => PRIORITY_ORDER[a.code] - PRIORITY_ORDER[b.code]);

  const overallLevel = Math.max(paramLevel.inTemp, paramLevel.outTemp, paramLevel.inFlow, paramLevel.outFlow, paramLevel.pressure, paramLevel.flame);

  return { level: overallLevel, dangerMessages, paramLevel };
}

// 사고 유형별 산업 사고 유사 패턴 레퍼런스 뱃지
export function getRefBadges(code, values, thresholds) {
  const badges = [];
  const flowAnomaly =
    calcParamLevel("inFlow", values.inFlow, thresholds) >= 1 || calcParamLevel("outFlow", values.outFlow, thresholds) >= 1;
  if (code === "OVER_PRESSURE" && flowAnomaly) badges.push("⚡ 여천 NCC 2024 유사 패턴");
  if (code === "FIRE_DETECTED") badges.push("⚡ 초기 화재 골든타임 — 5분 이내 초동조치 권장");
  if (code === "WATER_HAMMER") badges.push("⚡ 배관 파열 선행 징후 유형");
  return badges;
}

// Risk Score 0~100 계산 (유량30% + 압력25% + 온도25% + 화염20%)
// 센서 오류로 제외된 항목이 있으면 남은 항목의 가중치 합으로 재정규화한다.
export function computeRiskScore(values, thresholds, faultMap) {
  let weighted = 0;
  let totalWeight = 0;

  const flowKeys = ["inFlow", "outFlow"].filter((k) => !faultMap[k]);
  if (flowKeys.length > 0) {
    const drops = flowKeys.map((k) => {
      const nominal = nominalOf(k, thresholds) || 1;
      return Math.max(0, ((nominal - values[k]) / nominal) * 100);
    });
    const flowDev = clamp((Math.max(...drops) / 40) * 100, 0, 100);
    weighted += flowDev * 0.3;
    totalWeight += 0.3;
  }

  if (!faultMap.pressure) {
    const center = nominalOf("pressure", thresholds) || 1;
    const pressureDev = clamp((Math.abs(values.pressure - center) / center) * 100, 0, 100);
    weighted += pressureDev * 0.25;
    totalWeight += 0.25;
  }

  const tempKeys = ["inTemp", "outTemp"].filter((k) => !faultMap[k]);
  if (tempKeys.length > 0) {
    const devs = tempKeys.map((k) => {
      const { min, max } = thresholds[k];
      const nominal = (min + max) / 2;
      const rangeHalf = (max - min) / 2 || 1;
      return clamp((Math.abs(values[k] - nominal) / (rangeHalf * 4)) * 100, 0, 100);
    });
    weighted += Math.max(...devs) * 0.25;
    totalWeight += 0.25;
  }

  if (!faultMap.flame) {
    const dangerFlame = thresholds.flame.max * 6 || 1;
    const flameDev = clamp((values.flame / dangerFlame) * 100, 0, 100);
    weighted += flameDev * 0.2;
    totalWeight += 0.2;
  }

  return Math.round(clamp(totalWeight > 0 ? weighted / totalWeight : 0, 0, 100));
}

export function riskBucket(score) {
  if (score <= 30) return { label: "안전", color: COLORS.normal };
  if (score <= 60) return { label: "주의", color: COLORS.caution };
  if (score <= 80) return { label: "경고", color: COLORS.warning };
  return { label: "위험", color: COLORS.danger };
}

// ------------------------------------------------------------
// 설정 탭 저장 시 사용하는 임계값 유효성 검증
// 문제점 수정: 기존 코드는 입력값을 검증 없이 그대로 반영해 min > max,
// 음수 유량/압력/화염감지 같은 물리적으로 말이 안 되는 값도 저장할 수 있었다.
// ------------------------------------------------------------
export function validateThresholds(draft) {
  const errors = [];
  Object.entries(draft).forEach(([key, { min, max }]) => {
    if (min === "" || max === "" || Number.isNaN(min) || Number.isNaN(max)) {
      errors.push(`${key}: 숫자를 입력해주세요.`);
      return;
    }
    if (min >= max) {
      errors.push(`${key}: 하한값이 상한값보다 크거나 같습니다.`);
    }
    if (key !== "inTemp" && key !== "outTemp" && min < 0) {
      errors.push(`${key}: 하한값은 0 이상이어야 합니다.`);
    }
  });
  return { valid: errors.length === 0, errors };
}
