// GET /search?q=<关键词>&tag=<标签>&limit=<n> -> 在所有新闻条目里做全文 + 标签过滤。
// 公开、无需鉴权、CORS 友好，供 MCP / agent 一次调用拿到结果（不必逐期下载文章）。
//
// 注意：放在 /search 而不是 /api/ 下，是因为 /api/* 被后台 Basic Auth 守卫，搜索必须公开。
// 数据来自构建期生成的静态 /search-index.json（挂 CDN 缓存），这里只做过滤和摘要截取。

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const tag = (url.searchParams.get('tag') || '').trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 1), 50);

  if (!q && !tag) {
    return jsonResponse({ ok: false, error: '至少提供 q（关键词）或 tag（标签）之一' }, 400);
  }

  let index;
  try {
    const res = await fetch(`${url.origin}/search-index.json`, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    index = await res.json();
  } catch (err) {
    return jsonResponse({ ok: false, error: `读取搜索索引失败：${err.message}` }, 502);
  }

  const ql = q.toLowerCase();
  const tagl = tag.toLowerCase();
  const results = [];

  for (const item of index.items || []) {
    if (tag && !(item.tags || []).some((t) => String(t).toLowerCase() === tagl)) continue;

    let snippet = item.signal || (item.body || '').slice(0, 120);
    if (q) {
      const hay = `${item.title}\n${item.signal || ''}\n${item.body || ''}`;
      const at = hay.toLowerCase().indexOf(ql);
      if (at === -1) continue;
      snippet = hay.slice(Math.max(0, at - 40), at + 120).replace(/\s+/g, ' ').trim();
    }

    results.push({
      date: item.date,
      index: item.index,
      title: item.title,
      signal: item.signal,
      tags: item.tags,
      snippet,
      url: `${item.url}#${item.index}`,
    });
    if (results.length >= limit) break;
  }

  return jsonResponse({ ok: true, query: q || null, tag: tag || null, count: results.length, results });
}
