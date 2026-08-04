/**
 * TASK-7430: dynamic robots.txt so Sitemap: always points at this origin's /sitemap.xml
 * (static public/robots.txt hardcodes atlastays.com and is wrong on tenant custom domains).
 */

const BODY_TEMPLATE = (sitemapUrl: string) => `User-agent: *
Allow: /
Sitemap: ${sitemapUrl}

# AI search crawlers — explicitly allow for GEO visibility
User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: Bytespider
Allow: /
`;

export const onRequestGet = async ({ request }: { request: Request }) => {
  const origin = new URL(request.url).origin.replace(/\/+$/, "");
  const body = BODY_TEMPLATE(`${origin}/sitemap.xml`);
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
