import { classifyPath, recordHit } from './_lib/analytics.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const category = classifyPath(url.pathname);

  if (category && env.ANALYTICS) {
    // 后台计数，不阻塞响应
    context.waitUntil(recordHit(env.ANALYTICS, category).catch(() => {}));
  }

  return context.next();
}
