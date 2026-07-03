import { getCollection, type CollectionEntry } from 'astro:content';

export type DailyEntry = CollectionEntry<'daily'>;

export const SITE = 'https://www.aidailyinsights.cn';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** Given a YYYY-MM-DD string, return the Chinese weekday (e.g. 星期日). */
export function weekdayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return WEEKDAYS[d.getUTCDay()];
}

/** Format a date string as YYYY-MM-DD-星期X. */
export function dateWithWeekday(date: string): string {
  return `${date}-${weekdayOf(date)}`;
}

/** All daily issues, newest first. */
export async function getSortedPosts(): Promise<DailyEntry[]> {
  const entries = await getCollection('daily');
  return entries.sort((a, b) => (a.data.date < b.data.date ? 1 : -1));
}

/** All distinct tags with their posts, most-used tag first. */
export async function getTagIndex(): Promise<Map<string, DailyEntry[]>> {
  const posts = await getSortedPosts();
  const map = new Map<string, DailyEntry[]>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const list = map.get(tag) ?? [];
      list.push(post);
      map.set(tag, list);
    }
  }
  return new Map([...map.entries()].sort((a, b) => b[1].length - a[1].length));
}

/** URL path for a tag page (tag kept as-is; browsers/crawlers handle the encoding). */
export function tagUrl(tag: string): string {
  return `/tag/${encodeURIComponent(tag)}/`;
}

/** Shared Organization node for JSON-LD publisher/author. */
export const ORG_JSONLD = {
  '@type': 'Organization',
  name: 'AI Daily Insights',
  url: SITE,
  logo: { '@type': 'ImageObject', url: `${SITE}/favicon.svg` },
};

/** Parse the markdown body into structured news items (for agent-facing JSON). */
export function parseItems(body: string) {
  const parts = body.split(/^## /m).slice(1);
  return parts.map((part, i) => {
    const newlineAt = part.indexOf('\n');
    const headingLine = newlineAt === -1 ? part : part.slice(0, newlineAt);
    const rest = newlineAt === -1 ? '' : part.slice(newlineAt + 1);
    const title = headingLine.replace(/^❯\s*/, '').trim();
    const signalMatch = rest.match(/^>\s*\*\*signal:\*\*\s*([\s\S]*?)\s*$/m);
    const signal = signalMatch ? signalMatch[1].trim() : null;
    const bodyText = rest
      .replace(/^>.*$/gm, '')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\*\*([^*]*)\*\*/g, '$1')
      .trim();
    return { index: i + 1, title, signal, body: bodyText };
  });
}
