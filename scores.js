// api/scores.js — 됴무실 공용 랭킹 (Vercel 서버리스 함수)
// Upstash Redis(REST)를 사용하며 별도 npm 패키지는 필요 없습니다.
// Vercel 대시보드 > Storage 에서 Upstash Redis(KV)를 프로젝트에 연결하면 아래 환경변수가 자동 등록됩니다.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'dmoo:rank';

async function redis(cmds) {
  const r = await fetch(URL_ + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).map((x) => x.result);
}
const toBoard = (a) => {
  const out = [];
  for (let i = 0; i < a.length; i += 2) out.push({ n: a[i], s: Number(a[i + 1]) });
  return out;
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'no-db' });
  try {
    if (req.method === 'GET') {
      const [a] = await redis([['ZREVRANGE', KEY, 0, 9, 'WITHSCORES']]);
      return res.status(200).json({ board: toBoard(a) });
    }
    if (req.method === 'POST') {
      let b = req.body;
      if (typeof b === 'string') b = JSON.parse(b);
      const name = String((b && b.name) || '').trim().slice(0, 10);
      const score = Math.floor(Number(b && b.score));
      if (!name || !Number.isFinite(score) || score < 0 || score > 60000) return res.status(400).json({ error: 'bad' });
      // GT: 같은 이름은 더 높은 점수일 때만 갱신 (이름별 최고 기록 1개)
      const [, a, rank, best] = await redis([
        ['ZADD', KEY, 'GT', score, name],
        ['ZREVRANGE', KEY, 0, 9, 'WITHSCORES'],
        ['ZREVRANK', KEY, name],
        ['ZSCORE', KEY, name],
      ]);
      return res.status(200).json({ board: toBoard(a), rank: rank + 1, best: Number(best) });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: 'fail' });
  }
};
