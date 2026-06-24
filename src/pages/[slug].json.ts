import { getSortedPosts, parseItems, SITE } from '../posts';

export async function getStaticPaths() {
  const posts = await getSortedPosts();
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

export function GET({ props }: { props: { post: Awaited<ReturnType<typeof getSortedPosts>>[number] } }) {
  const { post } = props;
  return new Response(JSON.stringify({
    site: 'AI Daily Insights',
    slug: post.id,
    date: post.data.date,
    title: post.data.title,
    summary: post.data.summary,
    tags: post.data.tags,
    cover: post.data.cover ?? `/covers/${post.id}.jpg`,
    url: `${SITE}/${post.id}/`,
    items: parseItems(post.body ?? ''),
  }, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
