export interface Page {
    title: string;
    description?: string;
    htmlPath: string;
    markdownPath: string;
    sidebar?: SidebarSection[];
}

export interface SidebarSection {
    title: string;
    paths: string[];
}

export interface AgentDocsOptions {
    title?: string;
    summary?: string;
    guidance?: string;
    fallbackSection?: string;
}

export interface AgentDocsConfig extends AgentDocsOptions {
    title: string;
    site: string;
    base: string;
    trailingSlash: "always" | "never" | "ignore";
}

export const metadataName = "starlight-agent-docs";
