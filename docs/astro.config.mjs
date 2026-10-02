import starlight from "@astrojs/starlight";
import northwesternTheme from "@nu-appdev/northwestern-starlight-theme";
import starlightAgentDocs from "@nu-appdev/starlight-agent-docs";
import { defineConfig, passthroughImageService } from "astro/config";

export default defineConfig({
    site: "https://starlight-agent-docs.entapp.northwestern.edu",
    // The site has no images to optimize, so Astro does not need sharp.
    image: { service: passthroughImageService() },
    integrations: [
        starlight({
            title: "Starlight Agent Docs",
            description: "A Starlight plugin that publishes Markdown versions of every page and an llms.txt index.",
            lastUpdated: true,
            editLink: {
                baseUrl: "https://github.com/NIT-Administrative-Systems/starlight-agent-docs/edit/main/docs/",
            },
            social: [
                {
                    label: "GitHub",
                    icon: "github",
                    href: "https://github.com/NIT-Administrative-Systems/starlight-agent-docs",
                },
            ],
            sidebar: [{ label: "Getting started", items: ["install", "configuration", "usage"] }],
            plugins: [
                northwesternTheme(),
                starlightAgentDocs({
                    guidance:
                        "These docs describe @nu-appdev/starlight-agent-docs, a Starlight plugin. Start with the install page, then the configuration reference.",
                }),
            ],
        }),
    ],
});
