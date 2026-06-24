import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const daily = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/daily' }),
  schema: z.object({
    date: z
      .union([z.string(), z.date()])
      .transform((v) => (typeof v === 'string' ? v : v.toISOString().slice(0, 10))),
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    source: z.string().optional(),
  }),
});

export const collections = { daily };
