import { config } from "virtual:starlight-agent-docs/config";
import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import { sidebarSections } from "./sidebar.ts";
import { metadataName, type Page } from "./types.ts";
import { indexPath, markdownPath } from "./urls.ts";

export const onRequest = defineRouteMiddleware((context) => {
    const route = context.locals.starlightRoute;
    if (route.id === "404" || route.id.endsWith("/404") || (!import.meta.env.DEV && route.entry.data.draft)) return;
    const page: Page = {
        title: route.entry.data.title,
        description: route.entry.data.description,
        htmlPath: context.url.pathname,
        markdownPath: markdownPath(context.url.pathname),
        sidebar: sidebarSections(route.sidebar, config.site),
    };
    route.head.push(
        { tag: "meta", attrs: { name: metadataName, content: JSON.stringify(page) } },
        { tag: "link", attrs: { rel: "alternate", type: "text/markdown", href: page.markdownPath } },
        { tag: "link", attrs: { rel: "describedby", href: indexPath(config.base) } },
    );
});
