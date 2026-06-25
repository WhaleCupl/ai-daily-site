# 发布一期 AI Daily（Markdown 工作流）

内容现在是 **每天一个 Markdown 文件 + 一张封面图**，跟你公众号的发布习惯一致。
不再有手写 HTML 字符串。

## 内容存放在哪

| 路径 | 作用 |
| --- | --- |
| `src/content/daily/<日期>.md` | 当天的整期内容（frontmatter + 正文） |
| `public/covers/<日期>.jpg` | 当天封面图，文件名 = 日期，例如 `2026-06-24.jpg` |

文件名（`<日期>`）就是 slug，也是 URL：`/<日期>/`。最新一期 = 日期最大的文件，系统自动按日期倒序排，无需手动调顺序。

## 一个 .md 文件长什么样

```markdown
---
date: 2026-06-25
title: "今天的头条标题"
summary: "一句话 signal。"
tags: [SpaceX, OpenAI, Anthropic]
cover: /covers/2026-06-25.jpg   # 可省略，默认就是 /covers/<日期>.jpg
---

## ❯ 第一条新闻的标题

`[电报开局]` 正文第一段……**加粗重点**……

`[影响落点]` 正文第二段……

> **signal:** 这条新闻的一句话判断。

## ❯ 第二条新闻的标题

……
```

规则：
- 每条新闻用 `## ❯ 标题` 开头 —— 这些标题会**自动生成**文章顶部的「今日导航(tree)」。
- 段落开头的 `` `[电报开局]` `` 这种小标签用行内代码（反引号）。
- 每条结尾的判断用 `> **signal:** ...` 引用块。
- 封面图、meta 行、导航都由系统**自动渲染**，正文里不要再写。

## 发布步骤

1. **写正文。** 用 skill `/ai-daily-insights-writing` 或 `/ai-daily-financing-writing` 出正文，按上面格式存成 `src/content/daily/2026-06-25.md`。
2. **放封面。** 用 skill `/ai-daily-insights-image` 出图，存为 `public/covers/2026-06-25.jpg`。没图也不报错，会显示占位框。
3. **预览。** `npm run dev` → http://localhost:4321 检查列表 / 封面 / 正文 / 导航。
4. **部署。** 两种方式，任选其一：
   - **自动（推荐）**：`git push` 到 `main`，GitHub Actions（`.github/workflows/deploy.yml`）会自动 build 并发布到 Cloudflare Pages。
   - **手动**：`npm run deploy`（本地 build + `wrangler pages deploy`）。

> ⚠️ 注意：本项目的 Cloudflare Pages 是 **Direct Upload** 类型，**没有连 Git**——所以单纯 `git push` 到 GitHub *本身* 不会更新线上，必须经由上面的 Actions 或 `npm run deploy` 用 wrangler 上传 `dist`。
>
> 自动部署依赖两个 GitHub Secret（已配置）：`CLOUDFLARE_API_TOKEN`（权限 Cloudflare Pages\:Edit）、`CLOUDFLARE_ACCOUNT_ID`。换 token 时在仓库 Settings → Secrets → Actions 更新即可。

## 自动产出的 agent 接口（无需手动维护）

每期 .md 会自动派生出机器可读端点：

| 端点 | 内容 |
| --- | --- |
| `/index.json` | 所有文章列表（日期/标题/摘要/标签/URL/条数） |
| `/<日期>.json` | **单期结构化正文**：每条新闻拆成 `{index, title, signal, body}` |
| `/feed.xml` | RSS 订阅 |
| `/llms.txt` | 给 AI 的站点说明 + 端点清单 |

这就是后面做 MCP / CLI 的数据源 —— 它们只需 fetch 这些公开 URL。

## 从微信公众号搬旧文章

`tools/wechat-to-md.mjs` 把公众号文章链接直接转成 `src/content/daily/<日期>.md`（只取标题/日期/正文文字 + 文末 hashtag 标签，**图片全部丢弃**；兼容三种历史排版变体，自带限频重试）。

```bash
# 预览（不写文件）
node tools/wechat-to-md.mjs --dry "https://mp.weixin.qq.com/s/xxxx"

# 实际落库（可一次给多个链接，同一天会自动去重/覆盖）
node tools/wechat-to-md.mjs "https://mp.weixin.qq.com/s/aaa" "https://mp.weixin.qq.com/s/bbb"

# 然后照常发布
npm run build && npm run deploy
```

注意：同一篇文章短时间重复抓会被微信限频，工具会自动重试一次；批量很多篇时建议分几次跑。

