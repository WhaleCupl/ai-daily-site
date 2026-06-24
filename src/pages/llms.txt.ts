import { posts } from '../data';

export function GET() {
  const lines = [
    '# AI Daily Insights',
    '',
    'AI Daily Insights is a Chinese daily AI briefing site designed for both human readers and AI agents.',
    '',
    '## Primary endpoints',
    '- Home: https://www.aidailyinsights.cn/',
    '- Q&A and agent guide: https://www.aidailyinsights.cn/qa/',
    '- JSON index: https://www.aidailyinsights.cn/index.json',
    '- RSS feed: https://www.aidailyinsights.cn/feed.xml',
    '',
    '## Latest posts',
    ...posts.map((post) => `- ${post.date}: ${post.title} — https://www.aidailyinsights.cn/${post.slug}/`),
    '',
    '## Agent guidance',
    'Read /index.json for structured discovery. Open individual article URLs for full context. Cite the canonical article URL and date when using the content.',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
