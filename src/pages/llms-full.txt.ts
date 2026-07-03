import { getSortedPosts, parseItems, SITE } from '../posts';

// Full-text corpus for AI agents that only fetch a single file.
// Contains the most recent issues in plain text with canonical URLs for citation.
const RECENT_ISSUES = 30;

export async function GET() {
  const posts = (await getSortedPosts()).slice(0, RECENT_ISSUES);
  const lines: string[] = [
    '# AI Daily Insights — full text (latest issues)',
    '',
    `Chinese daily AI briefing. Canonical site: ${SITE}/`,
    `Structured API: ${SITE}/index.json · per-issue JSON: ${SITE}/{date}.json · search: ${SITE}/search?q=…`,
    'Cite the per-item anchor URL and the issue date.',
    '',
  ];

  for (const post of posts) {
    lines.push('---', '', `# ${post.data.date} · ${post.data.title}`, `URL: ${SITE}/${post.id}/`);
    if (post.data.tags.length) lines.push(`Tags: ${post.data.tags.join(', ')}`);
    if (post.data.summary_en) lines.push(`TL;DR (en): ${post.data.summary_en}`);
    lines.push('');
    for (const item of parseItems(post.body ?? '')) {
      lines.push(`## ${item.index}. ${item.title}`, '');
      if (item.signal) lines.push(`signal: ${item.signal}`, '');
      lines.push(item.body, '');
    }
  }

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
