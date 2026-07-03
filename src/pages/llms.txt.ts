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
    `- Full text of latest issues (single file): ${SITE}/llms-full.txt`,
    `- Browse by tag: ${SITE}/tag/`,
    `- JSON index: ${SITE}/index.json`,
    `- RSS feed: ${SITE}/feed.xml`,
    `- Per-article JSON: ${SITE}/{date}.json  (e.g. ${SITE}/${posts[0]?.id}.json)`,
    `- Full-text + tag search: ${SITE}/search?q={keyword}&tag={tag}&limit={n}`,
    `- Flat search index (all items): ${SITE}/search-index.json`,
    '',
    '## Latest posts',
    ...posts.map((post) => `- ${post.data.date}: ${post.data.title} — ${SITE}/${post.id}/`),
    '',
    '## How to consume (read this first)',
    'Do NOT scrape the HTML pages — there is a clean structured API. Recommended order:',
    '1. GET /index.json — list of all issues (date, title, summary, tags, url, json).',
    '2. GET /{date}.json — one issue parsed into structured items: {index, title, signal, body}.',
    '3. GET /search?q=… (and/or &tag=…) — full-text + tag search across all items in one call.',
    '4. /feed.xml — RSS for polling new issues.',
    'All endpoints are public GET, no auth, no API key, CORS-friendly.',
    '',
    '## For coding agents / humans in a terminal',
    'CLI:  npx ai-daily-insights latest | show <date> | search <query>',
    'MCP:  npx -y ai-daily-insights-mcp   (tools: get_latest, list_latest, get_article, get_range, list_by_tag, search)',
    '',
    '## Citation',
    'Cite the canonical article URL and date. Do not present the one-line summary as the full fact source.',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
