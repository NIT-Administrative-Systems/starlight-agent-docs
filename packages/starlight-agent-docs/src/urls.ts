export function markdownPath(htmlPath: string): string {
    if (htmlPath.endsWith(".html")) return `${htmlPath.slice(0, -5)}.md`;
    return `${htmlPath.replace(/\/$/, "")}/index.md`;
}

export function htmlPath(markdown: string, trailingSlash: "always" | "never" | "ignore"): string {
    if (markdown.endsWith("/index.md")) {
        const directory = markdown.slice(0, -8);
        return trailingSlash === "never" && directory !== "/" ? directory.slice(0, -1) : directory;
    }
    return `${markdown.slice(0, -3)}.html`;
}

export function basePath(base: string): string {
    return base === "/" ? "/" : `/${base.replace(/^\/|\/$/g, "")}/`;
}

export function indexPath(base: string): string {
    return `${basePath(base)}llms.txt`;
}

export function entryPath(id: string, base: string, trailingSlash: "always" | "never" | "ignore"): string {
    const slug = id === "index" ? "" : id.replace(/\/index$/, "").normalize();
    const path = basePath(base) + slug;
    return slug && trailingSlash === "never" ? path : `${path.replace(/\/$/, "")}/`;
}
