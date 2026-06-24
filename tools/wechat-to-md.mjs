#!/usr/bin/env node
// 把微信公众号文章链接转成 src/content/daily/<date>.md
//
// 用法:
//   node tools/wechat-to-md.mjs <url> [url2] ...
//   node tools/wechat-to-md.mjs --dry <url>      # 只打印结果，不写文件
//
// 说明:
//   - 只抓 标题/发布日期/正文文字 + 文末 hashtag 标签；图片一律丢弃
//   - 兼容三种历史排版变体（有/无 "> cat" 分隔、转义的 > signal、SVG 公式数字）
//   - 同一天会覆盖同名文件；抓取自带一次限频重试
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src/content/daily');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15';

const pad = (n) => String(n).padStart(2, '0');
const tsToDate = (ts) => {
  const z = new Date((Number(ts) + 8 * 3600) * 1000);
  return `${z.getUTCFullYear()}-${pad(z.getUTCMonth() + 1)}-${pad(z.getUTCDate())}`;
};

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

async function fetchArticle(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    const html = await res.text();
    // 微信限频时返回一个很小的验证页；重试一次通常即可
    if (html.length > 100_000 && html.includes('id="js_content"')) return html;
  }
  throw new Error('抓取失败或被限频（多为同一文章短时间重复抓），稍后再试');
}

function convert(html) {
  const title0 = html.match(/var msg_title = '([\s\S]*?)'\.html\(false\)/);
  const ct = html.match(/var ct = "(\d+)"/) || html.match(/var create_time = "(\d+)"/);
  const date = ct ? tsToDate(ct[1]) : null;

  const i = html.indexOf('id="js_content"');
  let c = html.slice(i);
  const cut = c.search(/id="js_pc_qr_code"|class="rich_media_tool|<script\b/);
  if (cut > 0) c = c.slice(0, cut);

  // 把 SVG 行内公式还原成 data-formula 里的真实文字（否则金额数字会丢）
  c = c.replace(/<span[^>]*\sdata-formula="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi, (_, f) => decode(f));
  c = c.replace(/<\/?(strong|b)\b[^>]*>/gi, '**');
  c = c.replace(/<\/(p|section|h[1-6]|div|li)>/gi, '\n');
  c = c.replace(/<br\s*\/?>/gi, '\n');
  c = c.replace(/<(p|section|h[1-6]|div|li)\b[^>]*>/gi, '\n');
  c = c.replace(/<[^>]+>/g, '');
  c = decode(c);
  c = c.replace(/\*\*\s*\*\*/g, '');

  let lines = c.split('\n').map((l) => l.replace(/[   　]/g, ' ').trim()).filter(Boolean);

  const bare = (l) => l.replace(/\*\*/g, '').trim();

  // 提取文末 hashtag 作为 tags
  let tags = [];
  lines = lines.filter((l) => {
    const b = bare(l);
    if (/^#[^\s#]/.test(b) && (b.match(/#/g) || []).length >= 2) {
      tags.push(...[...b.matchAll(/#([^\s#]+)/g)].map((m) => m[1]));
      return false;
    }
    return true;
  });
  tags = [...new Set(tags)].slice(0, 10);

  const isPromo = (b) => /还在为错过|关注\s*\*{0,2}AI Daily/.test(b);
  const isHeading = (l) => /^❯/.test(bare(l)) && !isPromo(bare(l));
  const skip = (b) =>
    /^(\/\/|>\s|>$|cat\s+\.\/|tree\s+\.\/|-{2,})/.test(b) ||
    /stdout\.|status:\s*parsed|article\[\d+\]/.test(b) ||
    isPromo(b);

  const idx = [];
  lines.forEach((l, k) => isHeading(l) && idx.push(k));

  const items = [];
  for (let n = 0; n < idx.length; n++) {
    const start = idx[n];
    const end = n + 1 < idx.length ? idx[n + 1] : lines.length;
    const title = bare(lines[start]).replace(/^❯\s*/, '').trim();
    const body = [];
    let signal = null;
    for (const l of lines.slice(start + 1, end)) {
      const lq = l.replace(/^>\s*/, '');
      const sm = lq.match(/^\*{0,2}signal[:：]\*{0,2}\s*(.+)$/i);
      if (sm) {
        signal = sm[1].replace(/\*\*$/, '').trim();
        continue;
      }
      const b = bare(l);
      if (!b || skip(b)) continue;
      const tag = l.match(/^(\[[^\]]+\])\s*(.*)$/);
      body.push(tag ? `\`${tag[1]}\` ${tag[2]}` : l);
    }
    items.push({ title, body, signal });
  }

  const lead = items[0];
  const title = lead ? lead.title : title0 ? decode(title0[1]) : 'untitled';
  const firstBody = (lead?.body[0] || '').replace(/`\[[^\]]*\]`\s*/, '').replace(/\*\*/g, '');
  const summary =
    items.find((x) => x.signal)?.signal ||
    (firstBody.match(/^[^。]*。/)?.[0] || firstBody.slice(0, 56));

  const md = items
    .map((it) => {
      const parts = [`## ❯ ${it.title}`, '', it.body.join('\n\n')];
      if (it.signal) parts.push('', `> **signal:** ${it.signal}`);
      return parts.join('\n');
    })
    .join('\n\n');

  const fm = [
    '---',
    `date: ${date}`,
    `title: ${JSON.stringify(title)}`,
    `summary: ${JSON.stringify(summary)}`,
    `tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`,
    'source: wechat',
    '---',
    '',
  ].join('\n');

  return { date, title, tags, items, content: fm + md + '\n' };
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const urls = args.filter((a) => /^https?:\/\//.test(a));

if (!urls.length) {
  console.error('用法: node tools/wechat-to-md.mjs <微信文章链接> [更多链接...] [--dry]');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const seen = new Set();
for (const url of urls) {
  try {
    const html = await fetchArticle(url.replace(/[?#].*$/, ''));
    const r = convert(html);
    if (!r.date || !r.items.length) {
      console.error(`⚠️  ${url}\n    解析不到结构（可能格式特殊），已跳过`);
      continue;
    }
    if (seen.has(r.date)) {
      console.log(`↺  ${r.date} 重复，跳过（同一天多链接）`);
      continue;
    }
    seen.add(r.date);
    const sig = r.items.filter((x) => x.signal).length;
    const file = join(OUT_DIR, `${r.date}.md`);
    if (dry) {
      console.log(`(dry) ${r.date}: ${r.items.length} 条新闻 / ${sig} signal / ${r.tags.length} tags — ${r.title.slice(0, 36)}`);
    } else {
      writeFileSync(file, r.content);
      console.log(`✓  ${r.date}.md  ${r.items.length} 条新闻 / ${sig} signal / ${r.tags.length} tags`);
    }
  } catch (e) {
    console.error(`✗  ${url}\n    ${e.message}`);
  }
}

if (!dry) console.log('\n完成。接着跑: npm run build && npm run deploy');
