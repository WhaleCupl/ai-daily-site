// GET /api/deploys -> 返回最近几次 GitHub Actions 部署运行的状态，供后台「部署状态」面板展示。
// 让后台编辑后能直接看到这次提交有没有构建成功，而不用切到 GitHub。
import { githubConfig, jsonResponse, HttpError } from '../_lib/github.js';

const WORKFLOW_FILE = 'deploy.yml';
const COUNT = 5;

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const cfg = githubConfig(env);
    const url =
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/actions/workflows/${WORKFLOW_FILE}/runs` +
      `?branch=${cfg.branch}&per_page=${COUNT}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'User-Agent': 'ai-daily-admin',
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new HttpError(502, `查询 GitHub Actions 失败：HTTP ${res.status} ${text}`);
    }
    const data = await res.json();
    const runs = (data.workflow_runs || []).map((r) => ({
      title: r.display_title || (r.head_commit && r.head_commit.message) || '(无标题)',
      status: r.status, // queued | in_progress | completed
      conclusion: r.conclusion, // success | failure | cancelled | null
      createdAt: r.created_at,
      url: r.html_url,
    }));
    return jsonResponse({ ok: true, runs });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return jsonResponse({ ok: false, error: err.message }, status);
  }
}
