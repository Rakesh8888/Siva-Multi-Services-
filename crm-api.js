const json = (data, status = 200) => new Response(JSON.stringify(data), {
 status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" }
});
const text = (value, max = 300) => String(value ?? "").trim().slice(0, max);
const id = () => crypto.randomUUID();
const code = prefix => prefix + "-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + crypto.randomUUID().slice(0,6).toUpperCase();
async function requireAdmin(request, env) {
 const expected = String(env.SIVA_ADMIN_TOKEN || "");
 const supplied = String(request.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "");
 if (!expected || supplied.length !== expected.length) return false;
 let mismatch = 0;
 for (let i=0;i<expected.length;i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
 return mismatch === 0;
}
function amountToPaise(value) {
 const amount=Number(value);
 if(!Number.isFinite(amount)||amount<=0||amount>100000000)return null;
 return Math.round(amount*100);
}
export async function handleCrmRequest(request,env) {
 const url=new URL(request.url);
 if(!env.SIVA_DB)return json({error:"CRM database is not connected yet. Configure the SIVA_DB D1 binding and apply migrations."},503);
 if(!await requireAdmin(request,env))return json({error:"Admin authentication failed."},401);
 try {
  if(request.method==="GET"&&url.pathname==="/api/crm/admin/summary"){
   const [customers,services,totals]=await Promise.all([
    env.SIVA_DB.prepare("SELECT COUNT(*) AS total FROM customers WHERE status='active'").first(),
    env.SIVA_DB.prepare("SELECT COUNT(*) AS total FROM service_cases WHERE status IN ('new','in_progress','waiting')").first(),
    env.SIVA_DB.prepare("SELECT COALESCE(SUM(CASE WHEN transaction_type='charge' THEN amount_paise WHEN transaction_type='refund' THEN -amount_paise ELSE 0 END),0) AS billed, COALESCE(SUM(CASE WHEN transaction_type='payment' THEN amount_paise ELSE 0 END),0) AS collected FROM transactions").first()
   ]);
   const billed=Number(totals?.billed||0),collected=Number(totals?.collected||0);
   return json({ok:true,customers:Number(customers?.total||0),openServices:Number(services?.total||0),billedPaise:billed,collectedPaise:collected,balancePaise:Math.max(0,billed-collected)});
  }
  if(request.method==="GET"&&url.pathname==="/api/crm/admin/customers"){
   const q=text(url.searchParams.get("q"),80);
   const sql="SELECT c.*, COALESCE((SELECT SUM(CASE WHEN t.transaction_type='charge' THEN t.amount_paise WHEN t.transaction_type IN ('payment','refund') THEN -t.amount_paise ELSE 0 END) FROM transactions t WHERE t.customer_id=c.id),0) AS balance_paise FROM customers c ";
   const stmt=q?env.SIVA_DB.prepare(sql+"WHERE c.full_name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ? ORDER BY c.created_at DESC LIMIT 200").bind("%"+q+"%","%"+q+"%","%"+q+"%"):env.SIVA_DB.prepare(sql+"ORDER BY c.created_at DESC LIMIT 200");
   const result=await stmt.all();return json({ok:true,customers:result.results||[]});
  }
  if(request.method==="POST"&&url.pathname==="/api/crm/admin/customers"){
   const body=await request.json(),fullName=text(body.fullName,120),phone=text(body.phone,24);
   if(fullName.length<2||phone.length<7)return json({error:"Enter a valid customer name and phone number."},400);
   const customerId=id(),customerCode=code("SIVA");
   await env.SIVA_DB.prepare("INSERT INTO customers (id,customer_code,full_name,phone,email,city,notes) VALUES (?,?,?,?,?,?,?)").bind(customerId,customerCode,fullName,phone,text(body.email,160)||null,text(body.city,80)||null,text(body.notes,1000)||null).run();
   await env.SIVA_DB.prepare("INSERT INTO audit_logs (id,action,record_type,record_id) VALUES (?,'create','customer',?)").bind(id(),customerId).run();
   return json({ok:true,customer:{id:customerId,customer_code:customerCode,full_name:fullName,phone}},201);
  }
  if(request.method==="GET"&&url.pathname==="/api/crm/admin/transactions"){
   const customerId=text(url.searchParams.get("customerId"),80);
   const sql="SELECT t.*,c.customer_code,c.full_name FROM transactions t JOIN customers c ON c.id=t.customer_id ";
   const result=customerId?await env.SIVA_DB.prepare(sql+"WHERE t.customer_id=? ORDER BY t.recorded_at DESC LIMIT 200").bind(customerId).all():await env.SIVA_DB.prepare(sql+"ORDER BY t.recorded_at DESC LIMIT 200").all();
   return json({ok:true,transactions:result.results||[]});
  }
  if(request.method==="POST"&&url.pathname==="/api/crm/admin/transactions"){
   const body=await request.json(),customerId=text(body.customerId,80),type=text(body.type,20),amountPaise=amountToPaise(body.amount),description=text(body.description,240);
   if(!customerId||!["charge","payment","refund"].includes(type)||!amountPaise||!description)return json({error:"Customer, entry type, valid amount and description are required."},400);
   const customer=await env.SIVA_DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first();
   if(!customer)return json({error:"Customer not found."},404);
   const transactionId=id();
   await env.SIVA_DB.prepare("INSERT INTO transactions (id,customer_id,transaction_type,amount_paise,description,reference_number,payment_method) VALUES (?,?,?,?,?,?,?)").bind(transactionId,customerId,type,amountPaise,description,text(body.referenceNumber,100)||null,text(body.paymentMethod,40)||null).run();
   await env.SIVA_DB.prepare("INSERT INTO audit_logs (id,action,record_type,record_id) VALUES (?,'create','transaction',?)").bind(id(),transactionId).run();
   return json({ok:true,transactionId},201);
  }
  if(request.method==="GET"&&url.pathname==="/api/crm/admin/services"){
   const result=await env.SIVA_DB.prepare("SELECT s.*,c.customer_code,c.full_name,c.phone FROM service_cases s JOIN customers c ON c.id=s.customer_id ORDER BY s.created_at DESC LIMIT 200").all();
   return json({ok:true,services:result.results||[]});
  }
  if(request.method==="POST"&&url.pathname==="/api/crm/admin/services"){
   const body=await request.json(),customerId=text(body.customerId,80),serviceType=text(body.serviceType,80);
   if(!customerId||!serviceType)return json({error:"Customer and service type are required."},400);
   const customer=await env.SIVA_DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first();
   if(!customer)return json({error:"Customer not found."},404);
   const serviceId=id(),caseCode=code("CASE");
   await env.SIVA_DB.prepare("INSERT INTO service_cases (id,case_code,customer_id,service_type,description,due_date) VALUES (?,?,?,?,?,?)").bind(serviceId,caseCode,customerId,serviceType,text(body.description,1000)||null,text(body.dueDate,10)||null).run();
   await env.SIVA_DB.prepare("INSERT INTO audit_logs (id,action,record_type,record_id) VALUES (?,'create','service_case',?)").bind(id(),serviceId).run();
   return json({ok:true,service:{id:serviceId,caseCode}},201);
  }
  return json({error:"CRM endpoint not found."},404);
 } catch(error) {
  console.error("SIVA CRM API error:",String(error?.message||error).slice(0,240));
  return json({error:"CRM request could not be completed. Check database setup and try again."},500);
 }
}