import { getSortedPosts, SITE } from '../posts';

export async function GET() {
  const posts = await getSortedPosts();
  const lines = [
    '# AI Daily Insights',
    '',
    'AI Daily Insights is a Chinese daily AI briefing site designed for both human readers and AI agents.',
    '',
    '## Primary endpoints',
    `- Home: ${SITE}/`,
    `- Q&A and agent guide: ${SITE}/qa/`,
    `- JSON index: ${SITE}/index.json`,
    `- RSS feed: ${SITE}/feed.xml`,
    `- Per-article JSON: ${SITE}/{date}.json  (e.g. ${SITE}/${posts[0]?.id}.json)`,
    '',
    '## Latest posts',
    ...posts.map((post) => `- ${post.data.date}: ${post.data.title} — ${SITE}/${post.id}/`),
    '',
    '## Agent guidance',
    'Read /index.json for structured discovery, then GET /{date}.json for a single issue parsed into structured news items (title, body, signal). Open the HTML article URL for full human-readable context. Cite the canonical article URL and date when using the content.',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
