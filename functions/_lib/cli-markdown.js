// 把「微信/CLI 终端风」的每日简报 markdown 转换成网站存储格式
// （frontmatter + 干净的 `## ❯` 段落）。
//
// 输入示例（无 frontmatter）：
//   **`> tree ./today --depth=1`**
//   - `01` ...
//   `// Fable CLI index ...`
//   **`> cat ./news/xxx.md`**
//   ## ❯ 头条标题
//   `[标签]` 正文...
//   > **signal:** 头条 signal
//   ...
//   `// Fable CLI digest ...`
//   #OpenAI #GPT5.6 ...
//
// 输出：
//   ---
//   date: 2026-06-27
//   title: "头条标题"
//   summary: "头条 signal"
//   tags: ["OpenAI", "GPT5.6", ...]
//   ---
//   ## ❯ 头条标题
//   ...（已剥掉所有终端外壳行）

// 需要剔除的「终端外壳」整行（trim 后匹配）：
const NOISE_LINE = [
  /^\*\*`>\s*cat\b[^`]*`\*\*$/, // **`> cat ./news/xxx.md`**
  /^\*\*`>\s*tree\b[^`]*`\*\*$/, // **`> tree ./today --depth=1`**
  /^`\/\/\s*Fable CLI[^`]*`$/, // `// Fable CLI index ...` / digest
];

// 末尾的话题标签行：连续多个 #标签，整行只有标签。
function isHashtagLine(trimmed) {
  return /^#[^\s#]+(\s+#[^\s#]+)+$/.test(trimmed);
}

export function isCliMarkdown(raw) {
  // 不以 frontmatter 开头、且能找到至少一个 `## ❯` 段落，就认为是 CLI 风文件。
  const trimmed = raw.trim();
  if (trimmed.startsWith('---')) return false;
  // 老 CLI 风：## ❯ 标题
  if (/^##\s+❯/m.test(raw)) return true;
  // 新编号风：小节是「## 01 MODEL」这种编号+分类，且带 `> ▪ SIGNAL` 落点
  if (/^##\s+\d+\s+\S/m.test(raw) && /^>\s*▪?\s*SIGNAL\b/im.test(raw)) return true;
  return false;
}

// —————————————————————————————————————————————————————————————
// 「纯 Markdown / 公众号彭博终端风」格式（既无 frontmatter，也无 tree/cat 外壳）。
// 输入示例：
//   # AI DAILY INSIGHTS · 2026-07-23 · 星期四
//   - `01` 谷歌二季度营收增24%...          ← 顶部索引，剥掉（与本期目录重复）
//   **`01 MARKET`**                        ← 分类标记，剥掉
//   ## 谷歌二季度营收增24%...              ← 真新闻标题（H2），保留并加 ❯ 前缀
//   `[财报超预期]` 正文...
//   > **▮ SIGNAL** 云增速82%...            ← 落点，归一化成 `> ▪ SIGNAL ...`
//   #Alphabet #OpenAI ...                  ← 末尾话题标签 -> tags
// 输出与 convertCliMarkdown 一致：frontmatter + 干净的 `## ❯` 段落。

const H1_RE = /^#\s+\S/; // # AI DAILY INSIGHTS ...（单 # 才是 H1；## 不匹配）
const INDEX_ITEM_RE = /^-\s+`\d+`\s/; // - `01` 谷歌...
const CATEGORY_MARKER_RE = /^\*\*`?\s*\d+\s+[A-Za-z]+\s*`?\*\*$/; // **`01 MARKET`**
// SIGNAL 落点，容忍 `> **▮ SIGNAL** ` / `> **▪ SIGNAL** ` / `> ▪ SIGNAL ` 各种写法
const SIGNAL_LINE_RE = /^>\s*\*{0,2}\s*[▮▪]?\s*SIGNAL\s*\*{0,2}\s*/i;

export function isPlainMarkdown(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('---')) return false;
  if (isCliMarkdown(raw)) return false; // 先让更专的 CLI 风路径接管
  if (!/^##\s+\S/m.test(raw)) return false; // 至少要有一个 ## 新闻小节
  // 再要求命中本格式的显著特征之一，避免误吞任意 Markdown：
  const lines = raw.split('\n').map((l) => l.trim());
  const hasSignal = lines.some((t) => SIGNAL_LINE_RE.test(t));
  const hasCategory = lines.some((t) => CATEGORY_MARKER_RE.test(t));
  const hasTags = lines.some((t) => isHashtagLine(t));
  return hasSignal || hasCategory || hasTags;
}

export function convertPlainMarkdown(raw, date) {
  const lines = raw.split('\n');

  // 1. 末尾话题标签行 -> tags
  let tags = [];
  const tagLine = lines.map((l) => l.trim()).find((t) => isHashtagLine(t));
  if (tagLine) {
    tags = tagLine.split(/\s+/).map((t) => t.replace(/^#/, '')).filter(Boolean);
  }

  // 2. 剥掉外壳：H1 大标题、顶部索引、分类标记、标签行（空行保留）
  const cleaned = lines
    .filter((l) => {
      const t = l.trim();
      if (!t) return true;
      if (tagLine && t === tagLine) return false;
      if (H1_RE.test(t)) return false;
      if (INDEX_ITEM_RE.test(t)) return false;
      if (CATEGORY_MARKER_RE.test(t)) return false;
      return true;
    })
    .join('\n');

  // 3. 从第一个 `## ` 开始截取
  const start = cleaned.search(/^##\s/m);
  if (start === -1) {
    throw new Error('未找到任何 `## ` 新闻小节，无法识别为简报内容');
  }
  let body = cleaned.slice(start).trim();

  // 4. 归一化 SIGNAL 落点，与站内既有文章统一成 `> ▪ SIGNAL ...`
  body = body.replace(new RegExp(SIGNAL_LINE_RE.source, 'gim'), '> ▪ SIGNAL ');

  // 5. title = 头条 `## ` 标题；summary = 头条 SIGNAL
  const sections = body.split(/^## /m).slice(1);
  const first = sections[0] || '';
  const heading = (first.split('\n')[0] || '').replace(/^❯\s*/, '').trim();
  if (!heading) {
    throw new Error('头条段落缺少标题');
  }
  const signalMatch = first.match(/^>\s*▪\s*SIGNAL\s*([\s\S]*?)\s*$/im);
  const summary = signalMatch ? signalMatch[1].trim() : heading;

  // 6. 给新闻标题补 ❯ 前缀，与站内既有排版一致（TOC 会自动剥掉 ❯）
  body = body.replace(/^##\s+(?!❯)/gm, '## ❯ ');

  // 7. 拼 frontmatter（JSON.stringify 保证引号/特殊字符安全）
  const frontmatter = [
    '---',
    `date: ${date}`,
    `title: ${JSON.stringify(heading)}`,
    `summary: ${JSON.stringify(summary)}`,
    `tags: ${JSON.stringify(tags)}`,
    '---',
  ].join('\n');

  return `${frontmatter}\n${body}\n`;
}

export function convertCliMarkdown(raw, date) {
  const lines = raw.split('\n');

  // 1. 抓末尾话题标签行 -> tags
  let tags = [];
  const tagLine = lines
    .map((l) => l.trim())
    .find((t) => isHashtagLine(t));
  if (tagLine) {
    tags = tagLine.split(/\s+/).map((t) => t.replace(/^#/, '')).filter(Boolean);
  }

  // 2. 删掉外壳行 + 标签行
  const cleaned = lines
    .filter((l) => {
      const t = l.trim();
      if (tagLine && t === tagLine) return false;
      return !NOISE_LINE.some((re) => re.test(t));
    })
    .join('\n');

  // 3. 从第一个 `## ` 开始截取（丢掉 tree 索引和前言）
  const startMatch = cleaned.search(/^##\s/m);
  if (startMatch === -1) {
    throw new Error('未找到任何 `## ❯` 段落，无法识别为简报内容');
  }
  let body = cleaned.slice(startMatch).trim();

  // 3.5 新编号风归一化：把「## 01 MODEL」这种分类标签小节改写成「## ❯ 真标题」，
  //     真标题取其后第一条独占整行的 **加粗** 行，并删掉那条加粗行（否则前台会重复渲染，
  //     且模板生成的「本期目录」只会显示分类标签而非新闻标题）。
  {
    const bodyLines = body.split('\n');
    const normalized = [];
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];
      if (/^##\s+\d+\s+\S+\s*$/.test(line)) {
        let j = i + 1;
        while (j < bodyLines.length && bodyLines[j].trim() === '') j++;
        const boldTitle = j < bodyLines.length ? bodyLines[j].match(/^\*\*(.+?)\*\*\s*$/) : null;
        if (boldTitle) {
          normalized.push(`## ❯ ${boldTitle[1].trim()}`);
          i = j; // 跳过中间空行与加粗标题行
          continue;
        }
      }
      normalized.push(line);
    }
    body = normalized.join('\n').trim();
  }

  // 4. 解析头条段落，取 title / summary
  const sections = body.split(/^## /m).slice(1);
  const first = sections[0] || '';
  const firstLines = first.split('\n');
  let heading = (firstLines[0] || '').replace(/^❯\s*/, '').trim();
  // 新编号风：小节首行是分类标签（如「01 MODEL」），真正标题在其后第一条独占整行的 **加粗** 行
  if (/^\d+\s+\S+$/.test(heading)) {
    const boldMatch = first.match(/^\*\*(.+?)\*\*\s*$/m);
    if (boldMatch) heading = boldMatch[1].trim();
  }
  if (!heading) {
    throw new Error('头条段落缺少标题');
  }
  // summary：老风 `> **signal:** ...`，新风 `> ▪ SIGNAL ...`
  const signalMatch =
    first.match(/^>\s*\*\*signal:\*\*\s*([\s\S]*?)\s*$/m) ||
    first.match(/^>\s*▪?\s*SIGNAL\s+([\s\S]*?)\s*$/m);
  const summary = signalMatch ? signalMatch[1].trim() : heading;

  // 5. 拼 frontmatter（用 JSON.stringify 保证引号/特殊字符安全，YAML 兼容 JSON 标量）
  const frontmatter = [
    '---',
    `date: ${date}`,
    `title: ${JSON.stringify(heading)}`,
    `summary: ${JSON.stringify(summary)}`,
    `tags: ${JSON.stringify(tags)}`,
    '---',
  ].join('\n');

  return `${frontmatter}\n${body}\n`;
}
