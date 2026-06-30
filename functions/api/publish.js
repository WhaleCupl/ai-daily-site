// Cloudflare Pages Function: 接收 /admin 页面上传/编辑的 .md 文件，
// 通过 GitHub Contents API 写入仓库，触发现有 GitHub Actions 自动部署。
//
// 需要在 Cloudflare Pages 项目的环境变量/secrets 里配置 GITHUB_TOKEN
// （fine-grained PAT，只需 Contents: Read & write，scope 到本仓库）。
import yaml from 'js-yaml';
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

  if (!/\.md$/i.test(file.name)) {
    return jsonResponse({ ok: false, error: `只接受 .md 文件，收到的是「${file.name}」` }, 400);
  }

  const raw = await file.text();
  const DATE_RE = /(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/;

  // 日期决定文章 slug 与上线日期，按优先级取，文件名叫什么都不影响：
  //   1) 内容 frontmatter 里的 date:  2) 文件名里的日期  3) 服务器当天
  const fmDate = raw.trim().startsWith('---')
    ? (raw.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})/m) || [])[1]
    : null;
  const nameDate = (file.name.match(DATE_RE) || [])[0];
  const date = fmDate || nameDate || new Date().toISOString().slice(0, 10);
  const filename = `${date}.md`;

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
  if (frontmatterEnd === -1) {
    return jsonResponse({ ok: false, error: 'frontmatter 没有结束的 --- 分隔线' }, 400);
  }
  const frontmatter = trimmed.slice(3, frontmatterEnd);

  // 真正用 YAML 解析 frontmatter——光检查字段名存在并不够：
  // summary 里嵌了未转义的英文引号之类的问题，会让构建期 astro 解析 YAML 失败，
  // 导致整次部署崩溃、前台无任何变化（看起来就是“后台编辑不生效”）。
  // 在这里拦截，把错误直接回显给后台，避免静默的坏部署。
  let parsed;
  try {
    parsed = yaml.load(frontmatter);
  } catch (err) {
    const reason = err && err.reason ? err.reason : (err && err.message) || '未知错误';
    return jsonResponse(
      { ok: false, error: `frontmatter YAML 解析失败：${reason}。常见原因：标题/摘要用英文引号包裹时，里面又出现了英文引号，请把内部引号改成中文引号「」或“”。` },
      400
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    return jsonResponse({ ok: false, error: 'frontmatter 不是合法的键值对' }, 400);
  }
  for (const field of ['date', 'title', 'summary']) {
    if (parsed[field] === undefined || parsed[field] === null || parsed[field] === '') {
      return jsonResponse({ ok: false, error: `frontmatter 里缺少 ${field} 字段` }, 400);
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
