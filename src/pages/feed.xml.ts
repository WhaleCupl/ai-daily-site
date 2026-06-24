import rss from '@astrojs/rss';
import { posts } from '../data';

export async function GET(context) {
  return rss({
    title: 'AI Daily Insights',
    description: '每日 AI 资讯，为人与 Agent 而生',
    site: context.site ?? 'https://www.aidailyinsights.cn',
    items: posts.map((post) => ({
      title: post.title,
      pubDate: new Date(`${post.date}T00:00:00+08:00`),
      description: post.summary,
      link: `/${post.slug}/`,
    })),
  });
}
