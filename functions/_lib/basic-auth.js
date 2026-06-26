// 简单 HTTP Basic Auth 守卫，给 /admin 和 /api/* 用。
// 不依赖 Cloudflare Access / Zero Trust，只需要一个 ADMIN_PASSWORD secret。
export function requireAdminAuth(request, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) {
    return new Response('未配置 ADMIN_PASSWORD，请先在 Cloudflare Pages 设置 secret', { status: 500 });
  }

  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Basic ')) {
    return unauthorized();
  }

  let decoded;
  try {
    decoded = atob(auth.slice(6));
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(':');
  const password = sep === -1 ? decoded : decoded.slice(sep + 1);
  if (password !== expected) {
    return unauthorized();
  }

  return null; // 通过校验
}

function unauthorized() {
  return new Response('需要登录后台才能访问', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="ai-daily-admin"' },
  });
}
