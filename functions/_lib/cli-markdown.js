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
