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

// 后台明细展示的天数，也是读取时回看的窗口。固定 7 天，保证按天面板布局恒定。
const WINDOW_DAYS = 7;
// 每日计数器的存活时间：超过这个天数的历史明细自动从 KV 过期，避免 key 无限堆积。
// 总量计数器（pv:total:*）不设 TTL，永久保留，所以总访问量始终准确。
const DAILY_TTL_SECONDS = 400 * 24 * 60 * 60;

export async function recordHit(kv, category) {
  const date = todayKey();
  await Promise.all([
    bump(kv, `pv:${date}:${category}`, { expirationTtl: DAILY_TTL_SECONDS }),
    bump(kv, 'pv:total:' + category),
  ]);
}

async function bump(kv, key, options) {
  const current = parseInt((await kv.get(key)) || '0', 10);
  await kv.put(key, String(current + 1), options);
}

/** 返回最近 WINDOW_DAYS 天的日期字符串（YYYY-MM-DD），今天在前。 */
function recentDates() {
  const dates = [];
  const base = Date.parse(todayKey() + 'T00:00:00Z');
  for (let i = 0; i < WINDOW_DAYS; i++) {
    dates.push(new Date(base - i * 86400000).toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * 读取统计，返回 { totals: {page,api}, daily: [{date,page,api}, ...] }（按日期降序）。
 * 总量直接读 2 个固定 key；明细只按需读最近 WINDOW_DAYS 天，读取成本恒定，与历史长度无关。
 */
export async function readStats(kv) {
  const num = async (key) => parseInt((await kv.get(key)) || '0', 10);

  const [page, api] = await Promise.all([num('pv:total:page'), num('pv:total:api')]);
  const totals = { page, api };

  const daily = await Promise.all(
    recentDates().map(async (date) => {
      const [page, api] = await Promise.all([num(`pv:${date}:page`), num(`pv:${date}:api`)]);
      return { date, page, api };
    })
  );

  // 固定返回最近 7 天（含全 0 的空白天）作为占位，让后台按天面板布局始终稳定。
  return { totals, daily };
}
