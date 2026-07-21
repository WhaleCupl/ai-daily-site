import { defineConfig } from 'astro/config';
import remarkCjkFriendly from 'remark-cjk-friendly';

export default defineConfig({
  site: 'https://www.aidailyinsights.cn',
  markdown: {
    // 中文标点紧贴 **加粗** 时，CommonMark 的左右侧界定规则会判定
    // 分隔符无效，导致输出字面星号（全站 76 篇里有 23 篇中招）。
    // remark-cjk-friendly 放宽 CJK 场景下的判定。移除会让 bug 复发。
    remarkPlugins: [remarkCjkFriendly],
  },
});
