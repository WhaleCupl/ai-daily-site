// 极简访问计数器，存在 Cloudflare KV（binding: ANALYTICS）。
// 不做去重/会话识别，只是原始命中次数——够看趋势，不是精确的"独立访客"统计。

/** 把路径归类成 'page'（人看的网页）或 'api'（MCP/CLI/RSS 等程序化调用的接口），不计入返回 null。 */
export function classifyPath(pathname) {
  if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) return null;
  if (
    pathname.startsWith('/_astro/') ||
    pathname.startsWith('/fonts/') ||
    pathname === '/favicon.svg' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return null;
  }
  if (pathname === '/index.json' || pathname === '/feed.xml' || pathname === '/llms.txt') return 'api';
  if (/^\/\d{4}-\d{2}-\d{2}\.json$/.test(pathname)) return 'api';
  return 'page';
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function recordHit(kv, category) {
  const date = todayKey();
  await Promise.all([bump(kv, `pv:${date}:${category}`), bump(kv, 'pv:total:' + category)]);
}

async function bump(kv, key) {
  const current = parseInt((await kv.get(key)) || '0', 10);
  await kv.put(key, String(current + 1));
}

/** 读取全部统计，返回 { totals: {page,api}, daily: [{date,page,api}, ...] }（按日期降序，最多 30 天）。 */
export async function readStats(kv) {
  const list = await kv.list({ prefix: 'pv:' });
  const entries = await Promise.all(
    list.keys.map(async (k) => ({ key: k.name, value: parseInt((await kv.get(k.name)) || '0', 10) }))
  );

  const totals = { page: 0, api: 0 };
  const byDate = new Map();

  for (const { key, value } of entries) {
    const parts = key.split(':'); // pv:<date|total>:<category>
    const [, scope, category] = parts;
    if (category !== 'page' && category !== 'api') continue;
    if (scope === 'total') {
      totals[category] = value;
    } else {
      const row = byDate.get(scope) || { date: scope, page: 0, api: 0 };
      row[category] = value;
      byDate.set(scope, row);
    }
  }

  const daily = Array.from(byDate.values())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30);

  return { totals, daily };
}
