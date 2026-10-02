import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StarlightPlugin } from "@astrojs/starlight/types";
import type { AstroIntegration } from "astro";
import { convertPage } from "./src/convert.ts";
import { generateLlms } from "./src/llms.ts";
import type { AgentDocsConfig, AgentDocsOptions, Page } from "./src/types.ts";
import { basePath, indexPath } from "./src/urls.ts";

const configId = "virtual:starlight-agent-docs/config";
const editLinkId = "virtual:starlight-agent-docs/edit-link";
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));

async function htmlFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await htmlFiles(path)));
        else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
    }
    return files;
}

function outputPath(directory: string, pathname: string, base: string): string {
    if (!pathname.startsWith(basePath(base))) throw new Error(`Export URL is outside the site base: ${pathname}`);
    const path = resolve(directory, decodeURIComponent(pathname.slice(basePath(base).length)));
    const difference = relative(directory, path);
    if (!difference || difference.startsWith("..") || isAbsolute(difference)) {
        throw new Error(`Invalid agent documentation output path: ${pathname}`);
    }
    return path;
}

async function assertMissing(path: string): Promise<void> {
    try {
        await stat(path);
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
        throw error;
    }
    throw new Error(`Agent documentation output conflicts with an existing file: ${path}`);
}

function integration(
    options: AgentDocsOptions,
    title: string,
    summary: string | undefined,
    originalEditLink: string,
): AstroIntegration {
    let config: AgentDocsConfig;
    let editLink = originalEditLink;
    return {
        name: "starlight-agent-docs",
        hooks: {
            "astro:config:setup"({ config: astro, updateConfig, injectRoute, command }) {
                if (!astro.site) throw new Error("starlight-agent-docs requires Astro site to be configured.");
                if (astro.output !== "static")
                    throw new Error("starlight-agent-docs currently supports static output only.");
                config = {
                    ...options,
                    title: options.title ?? title,
                    summary: options.summary ?? summary,
                    site: astro.site,
                    base: astro.base,
                    trailingSlash: astro.trailingSlash,
                };
                if (originalEditLink.startsWith(".")) editLink = resolve(fileURLToPath(astro.root), originalEditLink);
                if (command === "dev") {
                    injectRoute({ pattern: "/llms.txt", entrypoint: local("./src/dev-index.ts"), prerender: true });
                    injectRoute({ pattern: "/[...slug].md", entrypoint: local("./src/dev-route.ts"), prerender: true });
                }
                updateConfig({
                    vite: {
                        plugins: [
                            {
                                name: "starlight-agent-docs-config",
                                resolveId(id) {
                                    if (id === configId || id === editLinkId) return `\0${id}`;
                                },
                                load(id) {
                                    if (id === `\0${configId}`)
                                        return `export const config = ${JSON.stringify(config)};`;
                                    if (id === `\0${editLinkId}`) {
                                        return `export { default } from ${JSON.stringify(editLink)};`;
                                    }
                                },
                            },
                        ],
                    },
                });
            },
            async "astro:build:done"({ dir, logger }) {
                const directory = fileURLToPath(dir);
                const pages: Page[] = [];
                const exports = new Map<string, string>();
                for (const path of await htmlFiles(directory)) {
                    const result = await convertPage(await readFile(path, "utf8"), config.site);
                    if (!result) continue;
                    const target = outputPath(directory, result.page.markdownPath, config.base);
                    if (exports.has(target)) throw new Error(`Duplicate Markdown export: ${result.page.markdownPath}`);
                    exports.set(target, result.markdown);
                    pages.push(result.page);
                }
                if (!pages.length) throw new Error("No Starlight pages were available for Markdown export.");
                const index = outputPath(directory, indexPath(config.base), config.base);
                exports.set(index, generateLlms(pages, config));
                for (const path of exports.keys()) await assertMissing(path);
                for (const [path, content] of exports) {
                    await mkdir(dirname(path), { recursive: true });
                    await writeFile(path, content, { flag: "wx" });
                }
                logger.info(`Exported ${pages.length} Markdown pages and llms.txt.`);
            },
        },
    };
}

export default function starlightAgentDocs(options: AgentDocsOptions = {}): StarlightPlugin {
    return {
        name: "starlight-agent-docs",
        hooks: {
            "i18n:setup"({ injectTranslations }) {
                injectTranslations({ en: { "agentDocs.markdown": "View as Markdown" } });
            },
            "config:setup"({ config, updateConfig, addIntegration, addRouteMiddleware }) {
                if (config.prerender === false)
                    throw new Error("starlight-agent-docs requires prerendered documentation.");
                const title =
                    typeof config.title === "string"
                        ? config.title
                        : (Object.values(config.title)[0] ?? "Documentation");
                const original = config.components?.EditLink ?? "@astrojs/starlight/components/EditLink.astro";
                addIntegration(integration(options, title, config.description, original));
                addRouteMiddleware({ entrypoint: local("./src/route-middleware.ts"), order: "post" });
                updateConfig({
                    components: { ...config.components, EditLink: local("./src/components/MarkdownEditLink.astro") },
                });
            },
        },
    };
}

export type { AgentDocsOptions } from "./src/types.ts";
