import { z } from "zod";

// Pure data-layer schema. No DOM imports here so this module can be imported by
// the browser bundle, the Vite build plugin (Node), and scripts/sync-roms.ts (Node).

export const DisplaySchema = z.enum(["embed", "launch", "info"]);
export type Display = z.infer<typeof DisplaySchema>;

export const RomSchema = z
  .object({
    id: z.string().min(1), // slug; usually matches the repo name
    // Optional override used only by roms:sync to diff against the GitHub repo
    // name when the public id intentionally differs (e.g. get-proctered ->
    // get-proctered-public). The UI never reads this.
    repoName: z.string().min(1).optional(),
    title: z.string().min(1), // cart label text
    blurb: z.string(), // one line; hover tag + info screen
    tech: z.array(z.string()), // chips
    repo: z.string().url(), // github URL
    demo: z.string().url().optional(), // url for embed/launch; omit for info
    display: DisplaySchema,
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "accent must be a #rrggbb hex"),
    enabled: z.boolean(), // false => staged, never rendered
    hidden: z.boolean().optional(), // true => only shown after the Konami unlock
  })
  .refine((r) => r.display === "info" || !!r.demo, {
    message: "embed/launch ROMs must have a demo url",
    path: ["demo"],
  });

export type Rom = z.infer<typeof RomSchema>;

export const ContentSchema = z.object({
  version: z.number(),
  roms: z.array(RomSchema),
});

export type Content = z.infer<typeof ContentSchema>;

/** Parse + validate raw content, throwing a readable error on any bad entry. */
export function parseContent(raw: unknown): Content {
  const result = ContentSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • roms${i.path.length ? "." + i.path.join(".") : ""}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid content.json:\n${issues}`);
  }
  // Guard against duplicate ids, which would break shelf keys + sync diffing.
  const seen = new Set<string>();
  for (const rom of result.data.roms) {
    if (seen.has(rom.id)) throw new Error(`Invalid content.json: duplicate id "${rom.id}"`);
    seen.add(rom.id);
  }
  return result.data;
}
