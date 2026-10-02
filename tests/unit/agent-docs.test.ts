import assert from "node:assert/strict";
import type { StarlightRouteData } from "@astrojs/starlight/route-data";
import { test } from "vitest";
import { convertPage, parseHtml, readPage } from "../../packages/starlight-agent-docs/src/convert.ts";
import { generateLlms } from "../../packages/starlight-agent-docs/src/llms.ts";
import { sidebarSections } from "../../packages/starlight-agent-docs/src/sidebar.ts";
import type { AgentDocsConfig, Page } from "../../packages/starlight-agent-docs/src/types.ts";
import { entryPath, htmlPath, indexPath, markdownPath } from "../../packages/starlight-agent-docs/src/urls.ts";

const config: AgentDocsConfig = {
    title: "Docs",
    site: "https://example.com",
    base: "/",
    trailingSlash: "ignore",
};
const page: Page = {
    title: "Example",
    htmlPath: "/standards/example/",
    markdownPath: "/standards/example/index.md",
    description: "Example guidance",
    sidebar: [{ title: "Standards", paths: ["/standards/example/"] }],
};

function fixture(content: string, metadata = page): string {
    return `<html><head><meta name="starlight-agent-docs" content='${JSON.stringify(metadata)}'></head>
        <body><nav>Navigation</nav><main>${content}<footer>Edit page</footer></main></body></html>`;
}

test("URL mapping covers roots, base paths, trailing slashes, and HTML extensions", () => {
    for (const path of ["/", "/standards/example/", "/standards/example", "/docs/"]) {
        const markdown = markdownPath(path);
        assert.equal(markdown.endsWith("/index.md"), true);
        assert.equal(markdownPath(htmlPath(markdown, "ignore")), markdown);
    }
    assert.equal(markdownPath("/example.html"), "/example.md");
    assert.equal(htmlPath("/example.md", "never"), "/example.html");
    assert.equal(htmlPath("/docs/standards/example/index.md", "never"), "/docs/standards/example");
    assert.equal(indexPath("/docs"), "/docs/llms.txt");
    assert.equal(entryPath("introduction/index", "/docs/", "ignore"), "/docs/introduction/");
    assert.equal(entryPath("index", "/", "never"), "/");
});

test("converts rendered callouts, review questions, every tab, code, tables, and links", async () => {
    const result = await convertPage(
        fixture(`
        <h1>Example</h1>
        <aside class="starlight-aside" aria-label="Draft Standard">
            <p class="starlight-aside__title" aria-hidden="true"><svg></svg>Draft Standard</p>
            <p>Not an approved requirement.</p>
        </aside>
        <div role="note" aria-label="Already built? - No exceptions.">
            <p aria-hidden="true">Already built?</p><p>Existing applications MUST comply.</p>
        </div>
        <details><summary><span>For Review</span><span class="open-question__question">Use this?</span></summary><p>Unsettled.</p></details>
        <div role="tablist"><button id="django" role="tab">Django</button><button id="flask" role="tab">Flask</button></div>
        <div role="tabpanel" aria-labelledby="django"><p>Django guidance.</p></div>
        <div role="tabpanel" aria-labelledby="flask" hidden><p>Flask guidance.</p></div>
        <pre data-language="python"><code><div class="ec-line"><div class="code">if ready:</div></div><div class="ec-line"><div class="code">    run()</div></div></code></pre>
        <pre class="mermaid">graph TD\nA--&gt;B</pre>
        <table><thead><tr><th>Rule</th><th>Level</th></tr></thead><tbody><tr><td>Isolation</td><td>MUST</td></tr></tbody></table>
        <h2>Guidance</h2><a class="sl-anchor-link" href="#guidance">Section titled Guidance</a>
        <p><a href="#guidance">Section</a> <img src="../../diagram.png" alt="Diagram"></p>
        <button>Copy code</button><script>unexpectedScript()</script>
    `),
        config.site,
    );
    assert.ok(result);
    assert.match(result.markdown, /> \*\*Draft Standard\*\*/);
    assert.match(result.markdown, /> \*\*Already built\? - No exceptions\.\*\*/);
    assert.match(result.markdown, /For Review\s+- Use this\?/);
    assert.match(result.markdown, /\*\*Django\*\*[\s\S]*Django guidance/);
    assert.match(result.markdown, /\*\*Flask\*\*[\s\S]*Flask guidance/);
    assert.match(result.markdown, /```python\nif ready:\n {4}run\(\)\n```/);
    assert.match(result.markdown, /```mermaid\ngraph TD\nA-->B\n```/);
    assert.match(result.markdown, /\| Rule\s+\| Level/);
    assert.match(result.markdown, /https:\/\/example.com\/standards\/example\/#guidance/);
    assert.match(result.markdown, /https:\/\/example.com\/diagram.png/);
    assert.doesNotMatch(result.markdown, /Navigation|Edit page|Copy code|unexpectedScript|Section titled/);
});

test("converts file trees to nested lists and drops screen-reader-only code frame titles", async () => {
    const result = await convertPage(
        fixture(`
        <h1>Example</h1>
        <figure class="frame is-terminal"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="sh"><code><div class="ec-line"><div class="code">pnpm build</div></div></code></pre></figure>
        <starlight-file-tree><ul>
            <li class="directory"><details open><summary><span class="tree-entry"><span class="sr-only">Directory</span><svg></svg>dist/
            </span></summary><ul>
                <li class="file"><span class="tree-entry"><svg></svg>llms.txt</span></li>
                <li class="directory"><details open><summary><span class="tree-entry"><span class="sr-only">Directory</span><svg></svg>guides/</span></summary><ul>
                    <li class="file"><span class="tree-entry">index.md</span></li>
                </ul></details></li>
            </ul></details></li>
        </ul></starlight-file-tree>
    `),
        config.site,
    );
    assert.ok(result);
    assert.match(result.markdown, /\* dist\/\n\s+\* llms\.txt\n\s+\* guides\/\n\s+\* index\.md/);
    assert.doesNotMatch(result.markdown, /Terminal window|Directory|>/);
    assert.match(result.markdown, /```sh\npnpm build\n```/);
});

test("exports homepage hero content even when the title is not rendered", async () => {
    const result = await convertPage(
        fixture(`
        <div class="hero"><p>Documentation summary.</p><div class="actions"><a href="/start/">Start</a><a href="/about/">About</a></div></div>
    `),
        config.site,
    );
    assert.ok(result);
    assert.match(result.markdown, /^# Example/);
    assert.match(result.markdown, /\[Start\]\(https:\/\/example.com\/start\/\)\n\n\[About\]/);
});

test("skips non-documentation HTML and rejects invalid metadata", async () => {
    assert.equal(await convertPage("<html><main>Redirect</main></html>", config.site), undefined);
    assert.throws(() => readPage(parseHtml('<meta name="starlight-agent-docs" content="{}">')), /Invalid/);
    await assert.rejects(convertPage(fixture("Content").replace(/<main>.*<\/main>/s, ""), config.site), /Missing main/);
});

test("llms.txt is a deterministic index with escaped titles and a fallback section", () => {
    const other = { ...page, title: "Other [guide]", htmlPath: "/about/", markdownPath: "/about/index.md" };
    const output = generateLlms([page, other], {
        ...config,
        summary: "A summary",
        guidance: "Read requirement levels first.",
    });
    assert.match(output, /^# Docs\n\n> A summary\n\nRead requirement levels first\.\n\n## Standards/);
    assert.match(output, /\[Example\]\(https:\/\/example.com\/standards\/example\/index.md\): Example guidance/);
    assert.doesNotMatch(output, /\]\(</);
    assert.match(output, /## Other documentation[\s\S]*Other \\\[guide\\\]/);
    assert.equal(
        output,
        generateLlms([other, page], { ...config, summary: "A summary", guidance: "Read requirement levels first." }),
    );
    assert.throws(() => generateLlms([page], { ...config, guidance: "## Invalid heading" }), /must not contain/);
});

test("llms.txt groups pages under a configured base path", () => {
    const output = generateLlms(
        [
            {
                ...page,
                htmlPath: "/docs/standards/example/",
                markdownPath: "/docs/standards/example/index.md",
                sidebar: [{ title: "Standards", paths: ["/docs/standards/example.html"] }],
            },
        ],
        { ...config, base: "/docs/" },
    );
    assert.match(output, /## Standards/);
    assert.doesNotMatch(output, /## Other documentation/);
    assert.match(output, /https:\/\/example.com\/docs\/standards\/example\/index.md/);
});

test("resolved sidebar groups include nested and autogenerated entries but not external links", () => {
    const link = (href: string): StarlightRouteData["sidebar"][number] => ({
        type: "link",
        label: "Page",
        href,
        isCurrent: false,
        badge: undefined,
        attrs: {},
    });
    const sidebar: StarlightRouteData["sidebar"] = [
        link("/standalone/"),
        {
            type: "group",
            label: "Standards",
            collapsed: false,
            badge: undefined,
            entries: [
                link("/standards/second/"),
                {
                    type: "group",
                    label: "Nested",
                    collapsed: false,
                    badge: undefined,
                    autogenerate: { directory: "standards" },
                    entries: [link("/standards/example/"), link("https://elsewhere.example/standards/external/")],
                },
            ],
        },
    ];
    assert.deepEqual(sidebarSections(sidebar, config.site), [
        {
            title: "Standards",
            paths: ["/standards/second/", "/standards/example/"],
        },
    ]);
});

test("index follows sidebar group and page order with duplicates and missing entries omitted", () => {
    const second = {
        ...page,
        title: "Second",
        htmlPath: "/standards/second/",
        markdownPath: "/standards/second/index.md",
    };
    const output = generateLlms([page, second], config, [
        { title: "First group", paths: ["/standards/second/", "/missing/", "/standards/example/"] },
        { title: "Duplicate group", paths: ["/standards/example/"] },
        { title: "External group", paths: [] },
    ]);
    assert.ok(output.indexOf("[Second]") < output.indexOf("[Example]"));
    assert.equal(output.match(/\[Example\]/g)?.length, 1);
    assert.doesNotMatch(output, /Duplicate group|External group|Other documentation/);
    const fallback = generateLlms([page], { ...config, fallbackSection: "All docs" }, []);
    assert.match(fallback, /## All docs/);
    assert.doesNotMatch(fallback, /## Standards/);
});

test("page metadata retains resolved sidebar data and rejects malformed entries", () => {
    assert.deepEqual(readPage(parseHtml(fixture("Content")))?.sidebar, page.sidebar);
    const malformed = fixture("Content").replace('"paths":["/standards/example/"]', '"paths":[12]');
    assert.throws(() => readPage(parseHtml(malformed)), /Invalid/);
});

test("llms.txt encodes parentheses in link destinations without angle brackets", () => {
    const output = generateLlms(
        [
            {
                ...page,
                markdownPath: "/standards/example(v2)/index.md",
            },
        ],
        config,
    );
    assert.ok(output.includes("[Example](https://example.com/standards/example%28v2%29/index.md)"));
    assert.doesNotMatch(output, /\]\(</);
});
