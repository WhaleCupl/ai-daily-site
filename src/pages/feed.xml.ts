import rss from '@astrojs/rss';
import { getSortedPosts, SITE } from '../posts';

export async function GET(context: { site?: string }) {
  const posts = await getSortedPosts();
  return rss({
    title: 'AI Daily Insights',
    description: '每日 AI 资讯，为人与 Agent 而生',
    site: context.site ?? SITE,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: new Date(`${post.data.date}T00:00:00+08:00`),
      description: post.data.summary,
      link: `/${post.id}/`,
    })),
  });
}
