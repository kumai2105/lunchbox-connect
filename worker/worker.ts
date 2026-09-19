// Cloudflare Worker (wrangler.jsonc) — serves the built SPA from the assets
// binding with SPA fallback. The app is a static client: all data lives in
// Supabase and never passes through this worker.

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return Response.json(
        { error: 'LunchBox Connect is a client-side app; the API lives in Supabase.' },
        { status: 404 },
      );
    }

    // Let the assets binding handle everything else (SPA fallback included).
    return env.ASSETS.fetch(request);
  },
};

interface Env {
  ASSETS: Fetcher;
}
