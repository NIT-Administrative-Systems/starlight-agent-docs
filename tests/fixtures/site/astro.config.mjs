import starlight from "@astrojs/starlight";
import starlightAgentDocs from "@nu-appdev/starlight-agent-docs";
import { defineConfig } from "astro/config";

export default defineConfig({
    site: "https://example.com",
    integrations: [
        starlight({
            title: "Fixture documentation",
            pagefind: false,
            components: { EditLink: "./src/components/EditLink.astro" },
            head: [{ tag: "meta", attrs: { name: "fixture-metadata", content: "preserved" } }],
            sidebar: [
                { label: "Guides", items: [{ label: "Nested guides", items: ["guide"] }] },
                { label: "More guides", items: [{ autogenerate: { directory: "more" } }] },
            ],
            plugins: [starlightAgentDocs()],
        }),
    ],
});
