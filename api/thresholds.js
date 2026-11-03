// api/thresholds.js
// 설정 탭의 임계값(정상 범위)을 모든 접속자가 공유하도록 Redis에 저장한다.
//   GET  /api/thresholds  → 저장된 임계값 ({ thresholds: {...} | null, updatedAt })
//   POST /api/thresholds  → 임계값 저장 (바디: { thresholds: {...} })
//
// 보호: 저장할 때 x-settings-pin 헤더가 설정 비밀번호와 같아야 한다.
// 비밀번호는 Vercel 환경변수 SETTINGS_PIN으로 바꿀 수 있고, 없으면 기본값 DEFAULT_PIN을 쓴다.
// (기본값은 공개 저장소에 보이므로, 바꾸려면 Vercel 환경변수로 설정하는 것을 권장)
import { redisGet, redisSet } from "./_redis.js";

const KEY = "hex-scada:thresholds";
const DEFAULT_PIN = "1234";
const settingsPin = () => process.env.SETTINGS_PIN || DEFAULT_PIN;
const SENSOR_KEYS = ["inTemp", "outTemp", "inFlow", "outFlow", "pressure"];

// 프론트엔드 validateThresholds(src/utils/calculations.js)와 같은 규칙으로 서버에서도 한 번 더 검증한다.
function validate(input) {
  if (!input || typeof input !== "object") return { error: "thresholds 값이 없습니다." };
  const clean = {};
  for (const key of SENSOR_KEYS) {
    const row = input[key];
    const min = Number(row && row.min);
    const max = Number(row && row.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { error: `${key}: 숫자를 입력해주세요.` };
    if (min >= max) return { error: `${key}: 하한값이 상한값보다 크거나 같습니다.` };
    if (key !== "inTemp" && key !== "outTemp" && min < 0) return { error: `${key}: 하한값은 0 이상이어야 합니다.` };
    clean[key] = { min, max };
  }
  return { clean };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // 여러 명이 동시에 접속해도 Redis 조회가 사람 수만큼 늘지 않도록 Vercel CDN에서 2초 공유 캐시
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=2, stale-while-revalidate=2");
      const data = await redisGet(KEY);
      res.status(200).json({
        thresholds: data ? data.thresholds : null,
        updatedAt: data ? data.updatedAt : null,
        pinRequired: true,
      });
      return;
    }

    if (req.method === "POST") {
      res.setHeader("Cache-Control", "no-store");
      if (req.headers["x-settings-pin"] !== settingsPin()) {
        res.status(401).json({ error: "설정 비밀번호가 맞지 않습니다." });
        return;
      }
      const { clean, error } = validate((req.body || {}).thresholds);
      if (error) {
        res.status(400).json({ error });
        return;
      }
      const updatedAt = Date.now();
      await redisSet(KEY, { thresholds: clean, updatedAt });
      res.status(200).json({ ok: true, thresholds: clean, updatedAt });
      return;
    }

    res.status(405).json({ error: "GET 또는 POST 요청만 허용됩니다." });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: String((err && err.message) || err) });
  }
}
