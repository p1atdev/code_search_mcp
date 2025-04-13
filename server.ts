import {
    McpServer,
    ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GitHubClient, GrepAppClient } from "./client";

const server = new McpServer({
    name: "code_search",
    version: "1.0.0",
});

const grepApp = new GrepAppClient();
const github = new GitHubClient();

// Add an addition tool
server.tool(
    "search_on_github",
    "Search the actual code used on GitHub.",
    {
        code: z.string(),
        page: z.number(),
        limit: z.number(),
    },
    async ({ code, page, limit }) => {
        const result = await grepApp.search(code, limit, page);

        let message = `Found ${result.hits.total} results for "${code}":\n\n`;

        if (result.hits.hits.length === 0) {
            message = `No results found for "${code}".`;
        } else {
            result.hits.hits.forEach((hit, index) => {
                message += `${
                    index + 1
                }. **${hit.repo.raw}/${hit.path.raw}**\n`;
                message += `Branch: ${hit.branch.raw}\n`;
                const indentedSnippet = hit.content.snippet;
                message += `\`\`\`\n${indentedSnippet}\n\`\`\`\n`;
            });
            if (result.hits.total > result.hits.hits.length) {
                message +=
                    `(Showing ${result.hits.hits.length} of ${result.hits.total} results)\n`;
            }
        }

        return {
            content: [{ type: "text", text: message }],
        };
    },
);

server.tool(
    "get_file_from_github",
    "Get the file from GitHub.",
    {
        "repo": z.string(),
        "path": z.string(),
        "branch": z.string(),
        "linestart": z.number(),
        "lineend": z.number(),
    },
    async ({ repo, path, branch, linestart, lineend }) => {
        const code = await github.get(repo, path, branch);
        let message =
            `Found the file ${path} from ${repo} on branch ${branch}:\n\n`;

        const maxLines = code.split("\n").length;
        const startLine = Math.max(0, linestart - 1);

        message += `\`\`\`\n${
            code
                .split("\n")
                .slice(startLine, lineend)
                .map((line, index) => {
                    return `${startLine + index + 1}: ${line}`;
                })
                .join("\n")
        }\n\`\`\`\n`;
        if (lineend > maxLines) {
            message += `\n\n(Showing ${
                lineend - startLine
            } of ${maxLines} lines)\n`;
        }

        return {
            content: [{ type: "text", text: message }],
        };
    },
);

const transport = new StdioServerTransport();
await server.connect(transport);
