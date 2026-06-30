import { getSortedPosts, parseItems, SITE } from '../posts';

// 构建期生成的「搜索索引」：把每一期拆成扁平的新闻条目，每条带上所属日期/标签/URL。
// 这是一个静态文件，挂 CDN 缓存；服务端搜索接口 /search 只需拉它一次就能全文 + 标签过滤，
// 不用再像以前那样逐期下载。也对外公开，agent / MCP 可直接消费。
export async function GET() {
  const posts = await getSortedPosts();
  const items = posts.flatMap((post) =>
    parseItems(post.body ?? '').map((it) => ({
      date: post.data.date,
      issueTitle: post.data.title,
      tags: post.data.tags ?? [],
      url: `${SITE}/${post.id}/`,
      index: it.index,
      title: it.title,
      signal: it.signal,
      body: it.body,
    }))
  );

  return new Response(
    JSON.stringify(
      {
        site: 'AI Daily Insights',
        baseUrl: SITE,
        updated: posts[0]?.data.date,
        issueCount: posts.length,
        itemCount: items.length,
        items,
      },
      null,
      2
    ),
    { headers: { 'content-type': 'application/json; charset=utf-8' } }
  );
}
