import type { StarlightRouteData } from "@astrojs/starlight/route-data";
import type { SidebarSection } from "./types.ts";

export function sidebarSections(sidebar: StarlightRouteData["sidebar"], site: string): SidebarSection[] {
    const origin = new URL(site);
    function paths(entries: StarlightRouteData["sidebar"]): string[] {
        return entries.flatMap((entry) => {
            if (entry.type === "group") return paths(entry.entries);
            const url = new URL(entry.href, origin);
            return url.origin === origin.origin ? [url.pathname] : [];
        });
    }
    return sidebar.flatMap((entry) =>
        entry.type === "group" ? [{ title: entry.label, paths: paths(entry.entries) }] : [],
    );
}

export function readSidebar(value: unknown): SidebarSection[] {
    if (!Array.isArray(value)) throw new Error("Invalid agent documentation sidebar metadata.");
    return value.map((section: unknown) => {
        if (
            typeof section !== "object" ||
            section === null ||
            !("title" in section) ||
            typeof section.title !== "string" ||
            !("paths" in section) ||
            !Array.isArray(section.paths)
        )
            throw new Error("Invalid agent documentation sidebar metadata.");
        const paths = section.paths.map((path: unknown) => {
            if (typeof path !== "string") throw new Error("Invalid agent documentation sidebar path.");
            return path;
        });
        return { title: section.title, paths };
    });
}

export function normalizedPath(path: string): string {
    return decodeURI(path)
        .normalize()
        .replace(/(?:\/index)?\.html$/, "")
        .replace(/\/$/, "");
}
