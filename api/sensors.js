// api/sensors.js
// 프론트엔드 → GET /api/sensors (1초마다 폴링)
import { redisGet } from "./_redis.js";

const STALE_MS = 5000; // 5초 이상 갱신이 없으면 하드웨어 연결이 끊긴 것으로 판단

export default async function handler(req, res) {
  try {
    const data = await redisGet("hex-scada:latest");
    if (!data) {
      res.status(200).json({ online: false, values: null, lastSeen: null });
      return;
    }
    const online = Date.now() - data.timestamp < STALE_MS;
    res.status(200).json({ online, values: data, lastSeen: data.timestamp });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
}
