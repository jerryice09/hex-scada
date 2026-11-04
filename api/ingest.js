// api/ingest.js
// ESP32 → POST /api/ingest  (헤더: x-api-key, 바디: JSON 센서값)
import { redisSet } from "./_redis.js";

const SENSOR_KEYS = ["inTemp", "outTemp", "inFlow", "outFlow", "inPressure", "outPressure"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 허용됩니다." });
    return;
  }

  // 인증: Vercel 프로젝트 환경변수 INGEST_API_KEY와 ESP32 스케치의 API_KEY가 같아야 함
  const apiKey = req.headers["x-api-key"];
  if (!process.env.INGEST_API_KEY || apiKey !== process.env.INGEST_API_KEY) {
    res.status(401).json({ error: "인증 실패 (x-api-key 헤더를 확인하세요)" });
    return;
  }

  const body = req.body || {};
  // 예전 이름 호환 (hardware/hex_scada_uno_node.ino의 LEGACY_JSON_KEYS 참고)
  //   "pressure"  → 입구 압력,  "pressure2" → 출구 압력
  //   출구 압력이 아예 없는 아주 예전 코드면 입구 압력 값을 출구에도 채운다.
  if (body.inPressure === undefined && body.pressure !== undefined) body.inPressure = body.pressure;
  if (body.outPressure === undefined) {
    if (body.pressure2 !== undefined) body.outPressure = body.pressure2;
    else if (body.pressure !== undefined) body.outPressure = body.pressure;
  }
  const payload = {};
  for (const key of SENSOR_KEYS) {
    const v = Number(body[key]);
    if (Number.isNaN(v)) {
      res.status(400).json({ error: `${key} 값이 숫자가 아니거나 누락되었습니다.` });
      return;
    }
    payload[key] = v;
  }
  payload.timestamp = Date.now();

  try {
    await redisSet("hex-scada:latest", payload);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
}
