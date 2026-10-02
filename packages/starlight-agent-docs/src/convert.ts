import type { Element, ElementContent, Root, RootContent } from "hast";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { readSidebar } from "./sidebar.ts";
import { metadataName, type Page } from "./types.ts";

function classes(node: Element): string[] {
    const value: unknown = node.properties.className;
    return Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/\s+/) : [];
}

function elements(tree: Root | Element): Element[] {
    return tree.children.flatMap((node) => (node.type === "element" ? [node, ...elements(node)] : []));
}

function text(node: RootContent): string {
    if (node.type === "text") return node.value;
    if (node.type !== "element") return "";
    if (node.tagName === "br") return "\n";
    if (classes(node).includes("ec-line")) {
        const code = node.children.find((child) => child.type === "element" && classes(child).includes("code"));
        return `${code ? text(code) : node.children.map(text).join("")}\n`;
    }
    return node.children.map(text).join("");
}

function paragraph(value: string): Element {
    return {
        type: "element",
        tagName: "p",
        properties: {},
        children: [{ type: "element", tagName: "strong", properties: {}, children: [{ type: "text", value }] }],
    };
}

export function readPage(tree: Root): Page | undefined {
    const meta = elements(tree).find((node) => node.tagName === "meta" && node.properties.name === metadataName);
    if (!meta) return undefined;
    const value: unknown = JSON.parse(String(meta.properties.content));
    if (
        typeof value !== "object" ||
        value === null ||
        !("title" in value) ||
        typeof value.title !== "string" ||
        !("htmlPath" in value) ||
        typeof value.htmlPath !== "string" ||
        !("markdownPath" in value) ||
        typeof value.markdownPath !== "string" ||
        ("description" in value && typeof value.description !== "string")
    ) {
        throw new Error("Invalid agent documentation page metadata.");
    }
    return {
        title: value.title,
        htmlPath: value.htmlPath,
        markdownPath: value.markdownPath,
        description: "description" in value && typeof value.description === "string" ? value.description : undefined,
        sidebar: "sidebar" in value ? readSidebar(value.sidebar) : undefined,
    };
}

export function parseHtml(html: string): Root {
    return unified().use(rehypeParse).parse(html);
}

export async function convertPage(html: string, site: string): Promise<{ page: Page; markdown: string } | undefined> {
    const tree = parseHtml(html);
    const page = readPage(tree);
    if (!page) return undefined;
    const main = elements(tree).find((node) => node.tagName === "main");
    if (!main) throw new Error(`Missing main content in ${page.htmlPath}`);
    const url = new URL(page.htmlPath, site);
    const tabs = new Map(
        elements(main)
            .filter((node) => node.properties.role === "tab")
            .map((node) => [String(node.properties.id), text(node).trim()]),
    );

    function clean(parent: Element): void {
        parent.children = parent.children.flatMap((node): ElementContent[] => {
            if (node.type !== "element") return node.type === "comment" ? [] : [node];
            const classNames = classes(node);
            if (
                ["script", "style", "footer", "nav", "button", "input", "svg", "template"].includes(node.tagName) ||
                node.properties.role === "tablist" ||
                (node.properties.ariaHidden === "true" && !classNames.includes("starlight-aside__title")) ||
                classNames.includes("sl-anchor-link") ||
                classNames.includes("framework-notes__panel-name") ||
                classNames.includes("open-question__ref") ||
                classNames.includes("oq-toggle__control") ||
                node.properties.dataAgentDocsIgnore !== undefined
            )
                return [];

            if (node.tagName === "pre") {
                const code: Element = elements(node).find((child) => child.tagName === "code") ?? {
                    type: "element" as const,
                    tagName: "code",
                    properties: {},
                    children: node.children,
                };
                const language = classNames.includes("mermaid")
                    ? "mermaid"
                    : (node.properties.dataLanguage ?? code.properties.dataLanguage);
                node.properties = {};
                code.properties = language ? { className: [`language-${language}`] } : code.properties;
                code.children = [{ type: "text", value: text(code).replace(/\n$/, "") }];
                node.children = [code];
                return [node];
            }

            // Anchor links stay on HTML: its explicit IDs and heading slugs are authoritative.
            for (const attr of ["href", "src"] as const) {
                const value = node.properties[attr];
                if (typeof value === "string" && !/^(?:mailto:|tel:|data:)/i.test(value)) {
                    node.properties[attr] = new URL(value, url).href;
                }
            }
            const label =
                node.properties.role === "tabpanel" ? tabs.get(String(node.properties.ariaLabelledBy)) : undefined;
            clean(node);
            if (classNames.includes("open-question__question")) node.children.unshift({ type: "text", value: " - " });
            if (label) node.children.unshift(paragraph(label));
            const noteLabel = node.properties.role === "note" ? node.properties.ariaLabel : undefined;
            if (typeof noteLabel === "string") node.children.unshift(paragraph(noteLabel));
            if (classNames.includes("starlight-aside__title")) {
                node.children = [{ type: "element", tagName: "strong", properties: {}, children: node.children }];
            }
            if (classNames.includes("actions")) {
                node.children = node.children.map((child) =>
                    child.type === "element" && child.tagName === "a"
                        ? { type: "element", tagName: "p", properties: {}, children: [child] }
                        : child,
                );
            }
            if (
                node.tagName === "details" ||
                typeof noteLabel === "string" ||
                (node.tagName === "aside" && classNames.includes("starlight-aside"))
            ) {
                node.tagName = "blockquote";
                node.properties = {};
            } else if (node.tagName === "summary") {
                node.children = node.children.flatMap((child, index, siblings): ElementContent[] =>
                    index > 0 && child.type === "element" && siblings[index - 1]?.type === "element"
                        ? [{ type: "text", value: " " }, child]
                        : [child],
                );
                node.tagName = "p";
                node.properties = {};
            }
            return [node];
        });
    }
    clean(main);
    const content: Root = { type: "root", children: main.children };
    if (!elements(main).some((node) => node.tagName === "h1")) {
        content.children.unshift({
            type: "element",
            tagName: "h1",
            properties: {},
            children: [{ type: "text", value: page.title }],
        });
    }
    const processor = unified().use(rehypeRemark).use(remarkGfm).use(remarkStringify, { fences: true });
    const markdown = processor.stringify(await processor.run(content));
    return { page, markdown };
}
