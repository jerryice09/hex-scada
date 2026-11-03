// api/sensors.js
// 프론트엔드 → GET /api/sensors (1초마다 폴링)
import { redisGet } from "./_redis.js";

const STALE_MS = 5000; // 5초 이상 갱신이 없으면 하드웨어 연결이 끊긴 것으로 판단

export default async function handler(req, res) {
  // QR 코드로 여러 명이 동시에 접속해도 Redis 조회가 사람 수만큼 늘지 않도록,
  // Vercel CDN이 응답을 1초 동안 공유 캐시한다. (브라우저에는 캐시하지 않음: max-age=0)
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=1, stale-while-revalidate=1");
  try {
    const data = await redisGet("hex-scada:latest");
    if (!data) {
      res.status(200).json({ online: false, values: null, lastSeen: null });
      return;
    }
    const online = Date.now() - data.timestamp < STALE_MS;
    res.status(200).json({ online, values: data, lastSeen: data.timestamp });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: String((err && err.message) || err) });
  }
}
