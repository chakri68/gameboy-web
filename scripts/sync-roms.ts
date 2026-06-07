/**
 * npm run roms:sync — interactive, additive repo importer (spec §4).
 * Finds GitHub repos not yet in content.json and stages them as enabled:false.
 * Never reads-modifies existing entries.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as p from "@clack/prompts";
import { parseContent, type Rom } from "../src/schema";

const USER = "chakri68";
const CONTENT_PATH = resolve(process.cwd(), "public/content.json");

// Stable key order for pretty, minimal diffs.
const KEY_ORDER = [
  "version",
  "roms",
  "id",
  "repoName",
  "title",
  "blurb",
  "tech",
  "repo",
  "demo",
  "display",
  "tier",
  "accent",
  "enabled",
  "hidden",
];

const PALETTE = [
  "#e8b923", "#5bc8af", "#e2725b", "#7b6cd9", "#4f9d69", "#c0563f",
  "#3a7ca5", "#d98e04", "#f25f5c", "#ef476f", "#ffd166", "#118ab2",
  "#06d6a0", "#1db954", "#ff6b6b", "#4ecdc4", "#95e1d3", "#f38181",
];

interface GhRepo {
  name: string;
  fork: boolean;
  archived: boolean;
  description: string | null;
  html_url: string;
  homepage: string | null;
  has_pages: boolean;
  language: string | null;
  topics?: string[];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function fetchAllRepos(): Promise<GhRepo[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const repos: GhRepo[] = [];
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/users/${USER}/repos?per_page=100&page=${page}&sort=full_name`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${res.statusText}${token ? "" : " (set GITHUB_TOKEN to raise the 60/hr unauth limit)"}`);
    }
    const batch = (await res.json()) as GhRepo[];
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

function stagedEntry(repo: GhRepo): Rom {
  const tech = [...(repo.topics ?? []), repo.language]
    .filter((t): t is string => Boolean(t))
    .map((t) => t.toLowerCase());
  const dedupTech = [...new Set(tech)];

  let demo: string | undefined;
  if (repo.has_pages) demo = `https://${USER}.github.io/${repo.name}/`;
  else if (repo.homepage && repo.homepage.trim()) demo = repo.homepage.trim();

  let display: Rom["display"] = "info";
  if (demo) {
    try {
      display = new URL(demo).host.endsWith("github.io") ? "embed" : "launch";
    } catch {
      demo = undefined;
    }
  }

  return {
    id: repo.name,
    title: repo.name,
    blurb: repo.description ?? "",
    tech: dedupTech,
    repo: repo.html_url,
    ...(demo ? { demo } : {}),
    display,
    tier: 3,
    accent: PALETTE[hash(repo.name) % PALETTE.length],
    enabled: false,
  };
}

function serialize(content: { version: number; roms: Rom[] }): string {
  return JSON.stringify(content, KEY_ORDER, 2) + "\n";
}

async function main() {
  p.intro("roms:sync — stage new repos into content.json");

  const content = parseContent(JSON.parse(readFileSync(CONTENT_PATH, "utf8")));
  // Match against the repo name an entry came from (repoName override, else id).
  const existing = new Set(content.roms.map((r) => r.repoName ?? r.id));

  const spin = p.spinner();
  spin.start("Fetching repos from GitHub…");
  let repos: GhRepo[];
  try {
    repos = await fetchAllRepos();
  } catch (err) {
    spin.stop("Failed to fetch repos.");
    p.cancel(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  spin.stop(`Fetched ${repos.length} repos.`);

  // Warn (never delete) about existing entries whose repo no longer exists.
  const liveNames = new Set(repos.map((r) => r.name));
  const stale = content.roms.filter((r) => !liveNames.has(r.repoName ?? r.id));
  if (stale.length) {
    p.log.warn(
      `These content.json entries have no matching repo (renamed/deleted?) — left untouched:\n` +
        stale.map((r) => `  • ${r.id}`).join("\n")
    );
  }

  const candidates = repos
    .filter((r) => !r.fork && !r.archived)
    .filter((r) => !existing.has(r.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (candidates.length === 0) {
    p.outro("nothing to add ✓");
    return;
  }

  const picked = await p.multiselect({
    message: `Select repos to stage (${candidates.length} new):`,
    options: candidates.map((r) => ({
      value: r.name,
      label: r.name,
      hint: r.description ?? undefined,
    })),
    required: false,
  });

  if (p.isCancel(picked) || (picked as string[]).length === 0) {
    p.outro("nothing added");
    return;
  }

  const chosen = new Set(picked as string[]);
  const additions = candidates.filter((r) => chosen.has(r.name)).map(stagedEntry);
  const next = { ...content, roms: [...content.roms, ...additions] };

  writeFileSync(CONTENT_PATH, serialize(next));
  p.outro(`Staged ${additions.length} repo(s) as enabled:false. Review + flip them on in content.json.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
