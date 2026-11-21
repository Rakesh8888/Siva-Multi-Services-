const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const clean = (value, max = 200) => String(value ?? "").trim().slice(0, max);
const moneyToPaise = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) return null;
};
const isExcludedService = (value) => {
  const name = String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return /\\bpeople services?\\b/.test(name) || /\\btickets?\\b/.test(name);
};

async function requireAdmin(request, env) {
  const expected = env.ADMIN_API_TOKEN;
  const supplied = request.headers.get("Authorization") || "";
  if (!expected || !supplied.startsWith("Bearer ")) return false;
  const a = new TextEncoder().encode(supplied.slice(7));
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function customerCode() {
  return "SIVA-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function handleCrmRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/admin/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (!env.DB) return json({ error: "D1 binding DB is not configured." }, 503);
  if (!(await requireAdmin(request, env))) return json({ error: "Unauthorized." }, 401);

  try {
    if (url.pathname === "/api/admin/customers" && request.method === "GET") {
      const search = clean(url.searchParams.get("q"), 80);
      const result = search
        ? await env.DB.prepare(`SELECT c.id,c.customer_code,c.full_name,c.phone,c.email,c.created_at,
            COALESCE((SELECT SUM(s.fee_paise) FROM service_records s WHERE s.customer_id=c.id),0) AS total_fee_paise,
            COALESCE((SELECT SUM(p.amount_paise) FROM payments p WHERE p.customer_id=c.id),0) AS total_paid_paise
          FROM customers c WHERE c.full_name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ?
          ORDER BY c.created_at DESC LIMIT 100`).bind("%"+search+"%","%"+search+"%","%"+search+"%").all()
        : await env.DB.prepare(`SELECT c.id,c.customer_code,c.full_name,c.phone,c.email,c.created_at,
            COALESCE((SELECT SUM(s.fee_paise) FROM service_records s WHERE s.customer_id=c.id),0) AS total_fee_paise,
            COALESCE((SELECT SUM(p.amount_paise) FROM payments p WHERE p.customer_id=c.id),0) AS total_paid_paise
          FROM customers c ORDER BY c.created_at DESC LIMIT 100`).all();
      return json({ customers: result.results || [] });
    }

    if (url.pathname === "/api/admin/customers" && request.method === "POST") {
      const body = await readJson(request);
      if (!body) return json({ error: "A valid JSON body is required." }, 400);
      const fullName = clean(body.fullName, 120);
      const phone = clean(body.phone, 24);
      const email = clean(body.email, 160).toLowerCase();
      if (fullName.length < 2 || !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
        return json({ error: "Enter a customer name and valid phone number." }, 400);
      }
      const id = crypto.randomUUID();
      const code = customerCode();
      await env.DB.prepare(`INSERT INTO customers (id,customer_code,full_name,phone,email,notes)
        VALUES (?,?,?,?,?,?)`).bind(id,code,fullName,phone,email || null,clean(body.notes,1000) || null).run();
      return json({ ok: true, customer: { id, customerCode: code, fullName, phone, email } }, 201);
    }

    const match = url.pathname.match(/^\/api\/admin\/customers\/([a-f0-9-]+)(?:\/(services|payments|ledger))?$/i);
    if (!match) return json({ error: "Admin CRM endpoint not found." }, 404);
    const customerId = match[1];
    const action = match[2] || "";
    const customer = await env.DB.prepare("SELECT id,customer_code,full_name,phone,email,notes,created_at FROM customers WHERE id=?")
      .bind(customerId).first();
    if (!customer) return json({ error: "Customer not found." }, 404);

    if (!action && request.method === "GET") return json({ customer });

    if (action === "services" && request.method === "POST") {
      const body = await readJson(request);
      if (!body) return json({ error: "A valid JSON body is required." }, 400);
      const serviceName = clean(body.serviceName, 120);
      const feePaise = moneyToPaise(body.fee);
      if (!serviceName || feePaise === null) return json({ error: "Enter a service name and valid fee." }, 400);
      if (isExcludedService(serviceName)) return json({ error: "People Services and ticket booking are intentionally excluded from CRM records and customer balances." }, 400);
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO service_records (id,customer_id,service_name,fee_paise,status,notes)
        VALUES (?,?,?,?,?,?)`).bind(id,customerId,serviceName,feePaise,clean(body.status,30) || "pending",clean(body.notes,1000) || null).run();
      return json({ ok: true, service: { id, customerId, serviceName, feePaise, status: clean(body.status,30) || "pending" } }, 201);
    }

    if (action === "payments" && request.method === "POST") {
      const body = await readJson(request);
      if (!body) return json({ error: "A valid JSON body is required." }, 400);
      const amountPaise = moneyToPaise(body.amount);
      const method = clean(body.method, 40);
      const serviceRecordId = clean(body.serviceRecordId, 80);
      if (amountPaise === null || amountPaise <= 0 || !method || !serviceRecordId) return json({ error: "Select a trackable service and enter a valid payment amount and method." }, 400);
      const service = await env.DB.prepare("SELECT id,service_name FROM service_records WHERE id=? AND customer_id=?").bind(serviceRecordId,customerId).first();
      if (!service || isExcludedService(service.service_name)) return json({ error: "Payment must be linked to an eligible service record." }, 400);
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO payments (id,customer_id,service_record_id,amount_paise,method,reference,note)
        VALUES (?,?,?,?,?,?,?)`).bind(id,customerId,serviceRecordId,amountPaise,method,clean(body.reference,120) || null,clean(body.note,500) || null).run();
      return json({ ok: true, payment: { id, customerId, amountPaise, method } }, 201);
    }

    if (action === "ledger" && request.method === "GET") {
      const [services, payments] = await Promise.all([
        env.DB.prepare("SELECT id,service_name,fee_paise,status,notes,created_at FROM service_records WHERE customer_id=? AND lower(service_name) NOT LIKE '%people service%' AND lower(service_name) NOT LIKE '%ticket%' ORDER BY created_at DESC").bind(customerId).all(),
        env.DB.prepare("SELECT p.id,p.amount_paise,p.method,p.reference,p.note,p.created_at,s.service_name FROM payments p LEFT JOIN service_records s ON s.id=p.service_record_id WHERE p.customer_id=? ORDER BY p.created_at DESC").bind(customerId).all()
      ]);
      const totalFeePaise = (services.results || []).reduce((sum, item) => sum + item.fee_paise, 0);
      const totalPaidPaise = (payments.results || []).reduce((sum, item) => sum + item.amount_paise, 0);
      return json({
        customer,
        services: services.results || [],
        payments: payments.results || [],
        summary: { totalFeePaise, totalPaidPaise, balancePaise: totalFeePaise - totalPaidPaise }
      });
    }

    return json({ error: "Method not allowed." }, 405);
  } catch (error) {
    console.error("SIVA CRM error:", String(error?.message || error).slice(0, 180));
    return json({ error: "CRM request failed. Check the D1 schema and Worker logs." }, 500);
  }
}
