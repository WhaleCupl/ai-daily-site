// Cloudflare Pages Function: 接收 /admin 页面上传/编辑的 .md 文件，
// 通过 GitHub Contents API 写入仓库，触发现有 GitHub Actions 自动部署。
//
// 需要在 Cloudflare Pages 项目的环境变量/secrets 里配置 GITHUB_TOKEN
// （fine-grained PAT，只需 Contents: Read & write，scope 到本仓库）。
import { githubConfig, articlePath, putFile, jsonResponse, HttpError } from '../_lib/github.js';
import { isCliMarkdown, convertCliMarkdown } from '../_lib/cli-markdown.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ ok: false, error: '请求格式错误，需要 multipart/form-data' }, 400);
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return jsonResponse({ ok: false, error: '未收到文件' }, 400);
  }

  // 文件名只需「含有」一个 YYYY-MM-DD 日期即可（如 AI-Daily-Insights-2026-06-27.md），
  // 自动提取后规范成 <日期>.md 落库——日期就是文章 slug 和上线日期。
  if (!/\.md$/i.test(file.name)) {
    return jsonResponse({ ok: false, error: `只接受 .md 文件，收到的是「${file.name}」` }, 400);
  }
  const dateMatch = file.name.match(/(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/);
  if (!dateMatch) {
    return jsonResponse({ ok: false, error: `文件名里必须含有日期（YYYY-MM-DD），收到的是「${file.name}」` }, 400);
  }
  const date = dateMatch[0];
  const filename = `${date}.md`;

  const raw = await file.text();
  // 「微信/CLI 终端风」文件没有 frontmatter，先自动转换成网站存储格式。
  let content = raw;
  if (!raw.trim().startsWith('---') && isCliMarkdown(raw)) {
    try {
      content = convertCliMarkdown(raw, date);
    } catch (err) {
      return jsonResponse({ ok: false, error: `自动转换失败：${err.message}` }, 400);
    }
  }

  const trimmed = content.trim();
  if (!trimmed.startsWith('---')) {
    return jsonResponse({ ok: false, error: '文件缺少 frontmatter（应以 --- 开头）' }, 400);
  }
  const frontmatterEnd = trimmed.indexOf('---', 3);
  const frontmatter = frontmatterEnd > -1 ? trimmed.slice(0, frontmatterEnd) : '';
  for (const field of ['date:', 'title:', 'summary:']) {
    if (!frontmatter.includes(field)) {
      return jsonResponse({ ok: false, error: `frontmatter 里缺少 ${field.replace(':', '')} 字段` }, 400);
    }
  }

  try {
    const cfg = githubConfig(env);
    const { created } = await putFile(
      cfg,
      articlePath(filename),
      content,
      (created) => `${created ? '新增' : '更新'} ${filename}`
    );
    return jsonResponse({
      ok: true,
      message: `${created ? '已发布' : '已更新'} ${filename}，GitHub Actions 正在自动构建部署，约 1 分钟后线上生效。`,
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return jsonResponse({ ok: false, error: err.message }, status);
  }
}
