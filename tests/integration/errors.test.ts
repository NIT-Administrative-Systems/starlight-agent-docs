import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "astro";

const fixture = fileURLToPath(new URL("../fixtures/site/", import.meta.url));
const cases = join(fixture, ".cases");

interface Scenario {
    site?: string | null;
    pluginOptions?: string;
    starlightOptions?: string;
    astroOptions?: string;
    files?: Record<string, string>;
}

// Each scenario is a throwaway project inside the fixture so it resolves the fixture's dependencies.
async function project({
    site = "https://example.com",
    pluginOptions = "",
    starlightOptions = "",
    astroOptions = "",
    files = {},
}: Scenario) {
    await mkdir(cases, { recursive: true });
    const root = await mkdtemp(join(cases, "case-"));
    await cp(join(fixture, "src"), join(root, "src"), { recursive: true });
    await writeFile(
        join(root, "astro.config.mjs"),
        `import starlight from "@astrojs/starlight";
import starlightAgentDocs from "@nu-appdev/starlight-agent-docs";
import { defineConfig } from "astro/config";

export default defineConfig({
    ${site === null ? "" : `site: ${JSON.stringify(site)},`}
    ${astroOptions}
    integrations: [
        starlight({
            title: "Errors",
            pagefind: false,
            ${starlightOptions}
            plugins: [starlightAgentDocs(${pluginOptions})],
        }),
    ],
});
`,
    );
    for (const [path, content] of Object.entries(files)) {
        await mkdir(join(root, path, ".."), { recursive: true });
        await writeFile(join(root, path), content);
    }
    return root;
}

async function exists(path: string): Promise<boolean> {
    return stat(path).then(
        () => true,
        () => false,
    );
}

async function files(directory: string): Promise<string[]> {
    return (await readdir(directory, { recursive: true })).filter((name) => /\.(md|txt)$/.test(name));
}

const environment = process.env.NODE_ENV;
before(() => {
    process.env.NODE_ENV = "production";
});
after(async () => {
    await rm(cases, { recursive: true, force: true });
    if (environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = environment;
});

async function buildFails(scenario: Scenario, message: RegExp): Promise<{ root: string; outDir: string }> {
    const root = await project(scenario);
    const outDir = join(root, "dist");
    await assert.rejects(build({ root, outDir, logLevel: "silent" }), message);
    return { root, outDir };
}

test("rejects a site without an Astro `site` URL", async () => {
    await buildFails({ site: null }, /requires Astro site/);
});

test("rejects non-prerendered Starlight documentation", async () => {
    await buildFails({ starlightOptions: "prerender: false," }, /requires prerendered documentation/);
});

test("rejects non-static Astro output", async () => {
    await buildFails({ astroOptions: 'output: "server",' }, /static output only/);
});

test("rejects guidance containing Markdown headings", async () => {
    await buildFails(
        { pluginOptions: '{ guidance: "## Not allowed" }' },
        /guidance must not contain Markdown headings/,
    );
});

test("refuses to overwrite a public llms.txt and writes nothing", async () => {
    const { outDir } = await buildFails(
        { files: { "public/llms.txt": "hand written" } },
        /conflicts with an existing file/,
    );
    // The only file is the copy of the author's public/ file, not plugin output.
    assert.deepEqual(await files(outDir), ["llms.txt"]);
    assert.equal(await readFile(join(outDir, "llms.txt"), "utf8"), "hand written");
});

test("refuses to overwrite a public Markdown file and writes no other exports", async () => {
    const { outDir } = await buildFails(
        { files: { "public/guide/index.md": "hand written" } },
        /conflicts with an existing file/,
    );
    const written = await files(outDir);
    assert.deepEqual(written, [join("guide", "index.md")]);
    assert.equal(await readFile(join(outDir, "guide/index.md"), "utf8"), "hand written");
    assert.equal(await exists(join(outDir, "llms.txt")), false);
});
