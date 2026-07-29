// api/_redis.js
// Vercel 마켓플레이스에서 Upstash Redis 통합을 설치하면 아래 환경변수가 자동 주입된다.
// (통합 버전에 따라 이름이 KV_REST_API_* 이거나 UPSTASH_REDIS_REST_* 일 수 있어 둘 다 확인한다.)
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function command(cmd) {
  if (!URL || !TOKEN) {
    throw new Error(
      "Redis 환경변수가 설정되지 않았습니다. Vercel 프로젝트 Settings → Environment Variables에서 " +
        "KV_REST_API_URL/KV_REST_API_TOKEN (또는 UPSTASH_REDIS_REST_URL/TOKEN)이 있는지 확인하세요."
    );
  }
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) {
    throw new Error(`Redis 요청 실패: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.result;
}

export async function redisSet(key, valueObj) {
  return command(["SET", key, JSON.stringify(valueObj)]);
}

export async function redisGet(key) {
  const raw = await command(["GET", key]);
  return raw ? JSON.parse(raw) : null;
}
