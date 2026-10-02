import { normalizedPath } from "./sidebar.ts";
import type { AgentDocsConfig, Page, SidebarSection } from "./types.ts";

function inline(text: string): string {
    return text
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[\\[\]*_`<>]/g, "\\$&");
}

export function generateLlms(pages: Page[], config: AgentDocsConfig, sidebar?: SidebarSection[]): string {
    const lines = [`# ${inline(config.title)}`, ""];
    if (config.summary) lines.push(`> ${inline(config.summary)}`, "");
    if (config.guidance) {
        if (/^ {0,3}#{1,6}\s/m.test(config.guidance)) {
            throw new Error("Agent documentation guidance must not contain Markdown headings.");
        }
        lines.push(config.guidance.trim(), "");
    }

    const sections = sidebar ?? pages.find((page) => page.sidebar)?.sidebar ?? [];
    const remaining = new Map(
        [...pages]
            .sort((a, b) => a.htmlPath.localeCompare(b.htmlPath, "en"))
            .map((page) => [normalizedPath(page.htmlPath), page]),
    );
    const groups: { title: string; pages: Page[] }[] = [];
    for (const section of sections) {
        const entries: Page[] = [];
        for (const path of section.paths) {
            const key = normalizedPath(path);
            const page = remaining.get(key);
            if (!page) continue;
            entries.push(page);
            remaining.delete(key);
        }
        groups.push({ title: section.title, pages: entries });
    }
    const fallback = config.fallbackSection ?? "Other documentation";
    groups.push({ title: fallback, pages: [...remaining.values()] });
    for (const { title, pages: group } of groups) {
        if (!group.length) continue;
        lines.push(`## ${inline(title)}`, "");
        for (const page of group) {
            const url = new URL(page.markdownPath, config.site).href.replace(/\(/g, "%28").replace(/\)/g, "%29");
            lines.push(`- [${inline(page.title)}](${url})${page.description ? `: ${inline(page.description)}` : ""}`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
