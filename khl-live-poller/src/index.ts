import { LivePoller } from "./live-poller";
import type { Env } from "./live-poller";

export { LivePoller };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/wake" && request.method === "POST") {
      const id = env.LIVE_POLLER.idFromName("global");
      const stub = env.LIVE_POLLER.get(id);
      return stub.fetch(request);
    }

    return new Response("khl-live-poller: используй POST /wake", { status: 404 });
  },
};