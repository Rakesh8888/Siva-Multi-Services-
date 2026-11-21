import originalWorker from "./worker.js";
import { handleCrmRequest } from "./crm.js";
import { handleCustomerAuthRequest } from "./customer-auth.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/customer/") || /^\/api\/admin\/customers\/[a-f0-9-]+\/pin$/i.test(url.pathname)) {
      const response = await handleCustomerAuthRequest(request, env);
      if (response) return response;
    }
    if (url.pathname.startsWith("/api/admin/")) return handleCrmRequest(request, env);
    return originalWorker.fetch(request, env, ctx);
  }
};
