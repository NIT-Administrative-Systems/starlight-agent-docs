import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const packageDirectory = fileURLToPath(new URL("../../packages/starlight-agent-docs/", import.meta.url));
const fixture = fileURLToPath(new URL("../fixtures/site/", import.meta.url));
const starlight = process.env.STARLIGHT_VERSION ?? "latest";
const astro = process.env.ASTRO_VERSION ?? "latest";

// Installs the packed tarball into a clean project so a missing file, declaration, or dependency can't be hidden by workspace resolution.
test(`packed tarball builds in a clean consumer (Starlight ${starlight}, Astro ${astro})`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "starlight-agent-docs-consumer-"));
    try {
        await run("pnpm", ["pack", "--pack-destination", directory], { cwd: packageDirectory });
        const tarball = (await readdir(directory)).find((name) => name.endsWith(".tgz"));
        assert.ok(tarball);

        await cp(join(fixture, "src"), join(directory, "src"), { recursive: true });
        await cp(join(fixture, "astro.config.mjs"), join(directory, "astro.config.mjs"));
        await writeFile(
            join(directory, "package.json"),
            JSON.stringify({ name: "consumer", private: true, type: "module" }),
        );
        await writeFile(join(directory, "pnpm-workspace.yaml"), "allowBuilds:\n  esbuild: false\n  sharp: false\n");

        const options = { cwd: directory, timeout: 240_000 };
        await run(
            "pnpm",
            ["add", `@astrojs/starlight@${starlight}`, `astro@${astro}`, `file:${join(directory, tarball)}`],
            options,
        );
        await run("pnpm", ["exec", "astro", "build"], { ...options, env: { ...process.env, NODE_ENV: "production" } });

        const index = await readFile(join(directory, "dist/llms.txt"), "utf8");
        assert.match(index, /## Guides[\s\S]*## More guides[\s\S]*## Other documentation/);
        assert.doesNotMatch(index, /Unpublished draft/);
        const html = await readFile(join(directory, "dist/guide/index.html"), "utf8");
        assert.ok(html.includes("data-agent-docs-link"));
        assert.ok(html.includes("data-original-edit-link"));
        assert.match(await readFile(join(directory, "dist/guide/index.md"), "utf8"), /Applications MUST preserve/);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
