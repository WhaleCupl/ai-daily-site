import { readStats } from '../_lib/analytics.js';
import { jsonResponse } from '../_lib/github.js';

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.ANALYTICS) {
    return jsonResponse({ ok: false, error: '未绑定 ANALYTICS KV namespace' }, 500);
  }
  const stats = await readStats(env.ANALYTICS);
  return jsonResponse({ ok: true, ...stats });
}
