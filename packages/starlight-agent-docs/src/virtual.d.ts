/// <reference types="astro/client" />
/// <reference types="@astrojs/starlight" />
declare module "virtual:starlight-agent-docs/config" {
    export const config: import("./types").AgentDocsConfig;
}

declare module "virtual:starlight-agent-docs/edit-link" {
    const component: typeof import("@astrojs/starlight/components/EditLink.astro").default;
    export default component;
}

declare namespace StarlightApp {
    interface I18n {
        "agentDocs.markdown": string;
    }
}
