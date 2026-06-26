// 封装对 src/content/daily/ 下文章文件的 GitHub Contents API 操作，
// 供 publish / article / delete 三个接口共用。
const DEFAULT_OWNER = 'WhaleCupl';
const DEFAULT_REPO = 'ai-daily-site';
const DEFAULT_BRANCH = 'main';
const DIR = 'src/content/daily';

export function githubConfig(env) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new HttpError(500, '服务端未配置 GITHUB_TOKEN，请先在 Cloudflare Pages 设置 secret');
  }
  return {
    token,
    owner: env.GITHUB_OWNER || DEFAULT_OWNER,
    repo: env.GITHUB_REPO || DEFAULT_REPO,
    branch: env.GITHUB_BRANCH || DEFAULT_BRANCH,
  };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function articlePath(filename) {
  return `${DIR}/${filename}`;
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'ai-daily-admin',
    Accept: 'application/vnd.github+json',
  };
}

function apiUrl({ owner, repo }, path) {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}

/** 读取文件；不存在返回 null。 */
export async function getFile(cfg, path) {
  const res = await fetch(`${apiUrl(cfg, path)}?ref=${cfg.branch}`, { headers: headers(cfg.token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, `查询 GitHub 文件失败：HTTP ${res.status}`);
  const data = await res.json();
  return { sha: data.sha, content: fromBase64(data.content) };
}

/**
 * 创建或更新文件（自动判断 sha）。
 * message 可以是字符串，也可以是 (created: boolean) => string。
 */
export async function putFile(cfg, path, content, message) {
  const existing = await getFile(cfg, path);
  const created = !existing;
  const commitMessage = typeof message === 'function' ? message(created) : message;
  const res = await fetch(apiUrl(cfg, path), {
    method: 'PUT',
    headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content: toBase64(content),
      branch: cfg.branch,
      ...(existing ? { sha: existing.sha } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(502, `GitHub 提交失败：HTTP ${res.status} ${text}`);
  }
  return { created };
}

/** 删除文件。 */
export async function deleteFile(cfg, path, message) {
  const existing = await getFile(cfg, path);
  if (!existing) throw new HttpError(404, '文件不存在');
  const res = await fetch(apiUrl(cfg, path), {
    method: 'DELETE',
    headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha: existing.sha, branch: cfg.branch }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(502, `GitHub 删除失败：HTTP ${res.status} ${text}`);
  }
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
