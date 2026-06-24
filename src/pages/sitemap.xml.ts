import { getSortedPosts, SITE } from '../posts';

export async function GET() {
  const posts = await getSortedPosts();
  const staticUrls = ['/', '/qa/'];

  const urls = [
    ...staticUrls.map((path) => ({ loc: `${SITE}${path}`, lastmod: posts[0]?.data.date })),
    ...posts.map((post) => ({ loc: `${SITE}/${post.id}/`, lastmod: post.data.date })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n  </url>`)
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
