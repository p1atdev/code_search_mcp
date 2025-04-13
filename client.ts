import * as z from "zod";

export const LangBucketSchema = z.object({
    "count": z.number(),
    "val": z.string(),
});
export type LangBucket = z.infer<typeof LangBucketSchema>;

export const RepoBucketSchema = z.object({
    "count": z.number(),
    "owner_id": z.string(),
    "val": z.string(),
});
export type RepoBucket = z.infer<typeof RepoBucketSchema>;

export const BranchSchema = z.object({
    "raw": z.string(),
});
export type Branch = z.infer<typeof BranchSchema>;

export const ContentSchema = z.object({
    "snippet": z.string(),
});
export type Content = z.infer<typeof ContentSchema>;

export const LangSchema = z.object({
    "buckets": z.array(LangBucketSchema),
});
export type Lang = z.infer<typeof LangSchema>;

export const RepoSchema = z.object({
    "buckets": z.array(RepoBucketSchema),
});
export type Repo = z.infer<typeof RepoSchema>;

export const HitSchema = z.object({
    "branch": BranchSchema,
    "content": ContentSchema,
    "id": BranchSchema,
    "owner_id": BranchSchema,
    "path": BranchSchema,
    "repo": BranchSchema,
    "total_matches": BranchSchema,
});
export type Hit = z.infer<typeof HitSchema>;

export const FacetsSchema = z.object({
    "count": z.number(),
    "lang": LangSchema,
    "path": LangSchema.optional(),
    "repo": RepoSchema.optional(),
});
export type Facets = z.infer<typeof FacetsSchema>;

export const HitsSchema = z.object({
    "hits": z.array(HitSchema),
    "total": z.number(),
});
export type Hits = z.infer<typeof HitsSchema>;

export const SearchResultSchema = z.object({
    "facets": FacetsSchema,
    "hits": HitsSchema,
    "partial": z.boolean(),
    "time": z.number(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export class GrepAppClient {
    private readonly endpoint: string = "https://grep.app/api/search";

    private async _search(
        query: string,
        format: "c" | "e" = "e",
    ): Promise<SearchResult> {
        const url = new URL(this.endpoint);
        url.searchParams.append("q", query);
        url.searchParams.append("format", format);
        const res = await fetch(url, {
            method: "GET",
        });

        if (!res.ok) {
            throw new Error(`Error: ${res.statusText}`);
        }

        const json = await res.json();
        const parsed = SearchResultSchema.safeParse(json);
        if (!parsed.success) {
            throw new Error(
                `Error parsing response: ${parsed.error.message}`,
            );
        }

        return parsed.data;
    }

    async search(
        query: string,
        limit: number = 10,
        page: number = 1,
    ): Promise<SearchResult> {
        const result = await this._search(query);

        if (result.hits.total === 0) {
            throw new Error("No results found.");
        }

        // Calculate pagination indices
        const startIndex = (page - 1) * limit;
        if (
            startIndex >= result.hits.hits.length ||
            startIndex < 0
        ) {
            throw new Error("Invalid page number. No results found.");
        }
        const endIndex = Math.min(startIndex + limit, result.hits.hits.length);

        // we have to remove html tags
        const processedHits = result.hits.hits.map((hit) => {
            // Remove HTML tags using a regular expression
            const plainTextSnippet = hit.content.snippet.replace(
                /<\/pre>/g,
                "\n",
            ).replace(
                /(<div class=\"lineno\">\d+<\/div>|<[^>]*>)/g,
                "",
            );
            // unescape html escapes
            const unescapedSnippet = plainTextSnippet
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");

            return {
                ...hit,
                content: {
                    ...hit.content,
                    snippet: unescapedSnippet,
                },
            };
        });

        // Apply pagination
        result.hits.hits = processedHits.slice(startIndex, endIndex);

        return result;
    }
}

export class GitHubClient {
    private readonly endpoint: string = "https://raw.githubusercontent.com";

    async get(repo: string, path: string, branch: string): Promise<string> {
        const url = new URL(`${this.endpoint}/${repo}/${branch}/${path}`);
        const res = await fetch(url, {
            method: "GET",
        });

        if (!res.ok) {
            throw new Error(`Error: ${res.statusText}`);
        }

        const text = await res.text();
        return text;
    }
}
