import { getSortedPosts, parseItems, SITE } from '../posts';

export async function GET() {
  const posts = await getSortedPosts();
  return new Response(JSON.stringify({
    site: 'AI Daily Insights',
    baseUrl: SITE,
    updated: posts[0]?.data.date,
    count: posts.length,
    endpoints: {
      llms: `${SITE}/llms.txt`,
      rss: `${SITE}/feed.xml`,
      qa: `${SITE}/qa/`,
      article: `${SITE}/{date}.json`,
    },
    posts: posts.map((post) => ({
      slug: post.id,
      date: post.data.date,
      title: post.data.title,
      summary: post.data.summary,
      tags: post.data.tags,
      url: `${SITE}/${post.id}/`,
      json: `${SITE}/${post.id}.json`,
      itemCount: parseItems(post.body ?? '').length,
    })),
  }, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
