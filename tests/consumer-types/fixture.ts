import starlightAgentDocs, { type AgentDocsOptions } from "@nu-appdev/starlight-agent-docs";

const options: AgentDocsOptions = {
    title: "Docs",
    summary: "A summary",
    guidance: "Read the requirement levels first.",
    fallbackSection: "Other documentation",
};

export const plugin = starlightAgentDocs(options);
export const defaults = starlightAgentDocs();
