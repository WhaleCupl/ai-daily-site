// GET /api/article?date=YYYY-MM-DD -> 返回该日期文章的原始 markdown（含 frontmatter），供后台编辑回填。
import { githubConfig, articlePath, getFile, jsonResponse, HttpError } from '../_lib/github.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const date = new URL(request.url).searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({ ok: false, error: 'date 参数必须是 YYYY-MM-DD 格式' }, 400);
  }

  try {
    const cfg = githubConfig(env);
    const file = await getFile(cfg, articlePath(`${date}.md`));
    if (!file) {
      return jsonResponse({ ok: false, error: `没有找到 ${date}.md` }, 404);
    }
    return jsonResponse({ ok: true, date, content: file.content });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return jsonResponse({ ok: false, error: err.message }, status);
  }
}
