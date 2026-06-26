// Cloudflare Pages Function: 接收 /admin 页面上传的 .md 文件，
// 通过 GitHub Contents API 写入仓库，触发现有 GitHub Actions 自动部署。
//
// 需要在 Cloudflare Pages 项目的环境变量/secrets 里配置 GITHUB_TOKEN
// （fine-grained PAT，只需 Contents: Read & write，scope 到本仓库）。

const DEFAULT_OWNER = 'WhaleCupl';
const DEFAULT_REPO = 'ai-daily-site';
const DEFAULT_BRANCH = 'main';

export async function onRequestPost(context) {
  const { request, env } = context;

  const token = env.GITHUB_TOKEN;
  if (!token) {
    return json({ ok: false, error: '服务端未配置 GITHUB_TOKEN，请先在 Cloudflare Pages 设置 secret' }, 500);
  }

  const owner = env.GITHUB_OWNER || DEFAULT_OWNER;
  const repo = env.GITHUB_REPO || DEFAULT_REPO;
  const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH;

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: '请求格式错误，需要 multipart/form-data' }, 400);
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return json({ ok: false, error: '未收到文件' }, 400);
  }

  const filename = file.name;
  if (!/^\d{4}-\d{2}-\d{2}\.md$/.test(filename)) {
    return json({ ok: false, error: `文件名必须是 YYYY-MM-DD.md 格式，收到的是「${filename}」` }, 400);
  }

  const content = await file.text();
  const trimmed = content.trim();
  if (!trimmed.startsWith('---')) {
    return json({ ok: false, error: '文件缺少 frontmatter（应以 --- 开头）' }, 400);
  }
  const frontmatterEnd = trimmed.indexOf('---', 3);
  const frontmatter = frontmatterEnd > -1 ? trimmed.slice(0, frontmatterEnd) : '';
  for (const field of ['date:', 'title:', 'summary:']) {
    if (!frontmatter.includes(field)) {
      return json({ ok: false, error: `frontmatter 里缺少 ${field.replace(':', '')} 字段` }, 400);
    }
  }

  const path = `src/content/daily/${filename}`;
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'ai-daily-admin',
    Accept: 'application/vnd.github+json',
  };

  let sha;
  const existing = await fetch(`${apiBase}?ref=${branch}`, { headers });
  if (existing.status === 200) {
    const data = await existing.json();
    sha = data.sha;
  } else if (existing.status !== 404) {
    return json({ ok: false, error: `查询 GitHub 文件状态失败：HTTP ${existing.status}` }, 502);
  }

  const put = await fetch(apiBase, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: sha ? `更新 ${filename}` : `新增 ${filename}`,
      content: toBase64(content),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!put.ok) {
    const errText = await put.text();
    return json({ ok: false, error: `GitHub 提交失败：HTTP ${put.status} ${errText}` }, 502);
  }

  return json({
    ok: true,
    message: `${sha ? '已更新' : '已发布'} ${filename}，GitHub Actions 正在自动构建部署，约 1 分钟后线上生效。`,
  });
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
