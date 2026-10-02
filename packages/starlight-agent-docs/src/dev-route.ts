import { getCollection } from "astro:content";
import { config } from "virtual:starlight-agent-docs/config";
import type { APIRoute } from "astro";
import { convertPage, parseHtml, readPage } from "./convert.ts";
import { generateLlms } from "./llms.ts";
import type { Page } from "./types.ts";
import { basePath, entryPath, htmlPath, indexPath, markdownPath } from "./urls.ts";

export const prerender = true;

export async function getStaticPaths() {
    const docs = await getCollection("docs");
    return docs
        .filter((entry) => entry.id !== "404" && !entry.id.endsWith("/404"))
        .map((entry) => {
            const path = markdownPath(entryPath(entry.id, config.base, config.trailingSlash));
            return { params: { slug: path.slice(basePath(config.base).length, -3) } };
        });
}

export const GET: APIRoute = async (context) => {
    const path = context.url.pathname;
    if (path === indexPath(config.base)) {
        const docs = await getCollection("docs");
        const pages: Page[] = docs
            .filter((entry) => entry.id !== "404" && !entry.id.endsWith("/404"))
            .map((entry) => {
                const path = entryPath(entry.id, config.base, config.trailingSlash);
                return {
                    title: entry.data.title,
                    description: entry.data.description,
                    htmlPath: path,
                    markdownPath: markdownPath(path),
                };
            });
        let sidebar: Page["sidebar"] = [];
        if (pages[0]) {
            const response = await context.rewrite(new Request(new URL(pages[0].htmlPath, context.url)));
            if (!response.ok) throw new Error(`Cannot read documentation sidebar: ${response.status}`);
            const page = readPage(parseHtml(await response.text()));
            if (!page?.sidebar) throw new Error("Missing agent documentation sidebar metadata.");
            sidebar = page.sidebar;
        }
        return new Response(context.request.method === "HEAD" ? null : generateLlms(pages, config, sidebar), {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    }
    const response = await context.rewrite(new Request(new URL(htmlPath(path, config.trailingSlash), context.url)));
    if (!response.ok) return response;
    const result = await convertPage(await response.text(), config.site);
    if (!result || result.page.markdownPath !== path) {
        return new Response("Markdown documentation not found", { status: 404 });
    }
    return new Response(context.request.method === "HEAD" ? null : result.markdown, {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            Link: `<${indexPath(config.base)}>; rel="describedby"`,
        },
    });
};

export const HEAD: APIRoute = GET;
