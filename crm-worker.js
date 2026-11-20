import originalWorker from "./worker.js";
import { handleCrmRequest } from "./crm.js";

// Keep every existing website, AI, voice and asset route intact.
// Only the new protected admin CRM paths are handled here.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/admin/")) {
      return handleCrmRequest(request, env);
    }
    return originalWorker.fetch(request, env, ctx);
  }
};
