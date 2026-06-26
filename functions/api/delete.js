// POST /api/delete  body: { "date": "YYYY-MM-DD" } -> 删除该日期的文章文件，触发自动部署。
import { githubConfig, articlePath, deleteFile, jsonResponse, HttpError } from '../_lib/github.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: '请求体必须是 JSON' }, 400);
  }

  const date = body && body.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({ ok: false, error: 'date 字段必须是 YYYY-MM-DD 格式' }, 400);
  }

  try {
    const cfg = githubConfig(env);
    await deleteFile(cfg, articlePath(`${date}.md`), `删除 ${date}.md`);
    return jsonResponse({ ok: true, message: `已删除 ${date}，GitHub Actions 正在自动部署，约 1 分钟后线上生效。` });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return jsonResponse({ ok: false, error: err.message }, status);
  }
}
