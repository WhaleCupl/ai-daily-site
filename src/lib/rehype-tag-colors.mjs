import { visit } from 'unist-util-visit';

// 给每篇文章里 `[电报开局]` 这类行内标签按出现顺序循环上色
// 顺序：红 → 黄 → 绿 → 青 → 蓝 → 紫 → 循环
const COLOR_COUNT = 6;

export default function rehypeTagColors() {
  return (tree) => {
    let i = 0;
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'p') return;
      const first = node.children.find(
        (c) => c.type === 'element' || (c.type === 'text' && c.value.trim() !== '')
      );
      if (!first || first.type !== 'element' || first.tagName !== 'code') return;
      first.properties = first.properties || {};
      const existing = first.properties.className || [];
      first.properties.className = [
        ...(Array.isArray(existing) ? existing : [existing]),
        `tag-c${i % COLOR_COUNT}`,
      ];
      i += 1;
    });
  };
}
