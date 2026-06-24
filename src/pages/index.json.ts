import { posts } from '../data';

export function GET() {
  return new Response(JSON.stringify({
    site: 'AI Daily Insights',
    baseUrl: 'https://www.aidailyinsights.cn',
    updated: posts[0]?.date,
    endpoints: {
      llms: 'https://www.aidailyinsights.cn/llms.txt',
      rss: 'https://www.aidailyinsights.cn/feed.xml',
      qa: 'https://www.aidailyinsights.cn/qa/',
    },
    posts: posts.map((post) => ({
      ...post,
      url: `https://www.aidailyinsights.cn/${post.slug}/`,
    })),
  }, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
