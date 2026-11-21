const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" } });
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
const randomHex = n => { const b=new Uint8Array(n); crypto.getRandomValues(b); return hex(b); };
async function digest(value){ return hex(await crypto.subtle.digest("SHA-256", enc.encode(value))); }
async function pinHash(pin,salt){
 const key=await crypto.subtle.importKey("raw",enc.encode(pin),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:Uint8Array.from(salt.match(/../g),x=>parseInt(x,16)),iterations:100000,hash:"SHA-256"},key,256);
 return hex(bits);
}
async function adminOk(request,env){
 const expected=env.ADMIN_API_TOKEN||"", got=(request.headers.get("Authorization")||"").replace(/^Bearer /,"");
 if(!expected||!got||expected.length!==got.length)return false;
 let d=0;for(let i=0;i<got.length;i++)d|=got.charCodeAt(i)^expected.charCodeAt(i);return d===0;
}
async function sessionCustomer(request,env){
 const token=(request.headers.get("Authorization")||"").replace(/^Bearer /,"");
 if(!token)return null;
 const row=await env.DB.prepare("SELECT c.id,c.customer_code,c.full_name FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=? AND s.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(await digest(token)).first();
 return row||null;
}
export async function handleCustomerAuthRequest(request,env){
 const url=new URL(request.url),path=url.pathname;
 let authenticatedAdminPinRequest=false;
 if(!path.startsWith("/api/customer/") && !/^\/api\/admin\/customers\/[a-f0-9-]+\/pin$/i.test(path))return null;
 if(!env.DB)return json({error:"Database is not configured."},503);
 try{
  if(path.startsWith("/api/admin/")){
   if(request.method!=="POST")return json({error:"Method not allowed."},405);
   if(!(await adminOk(request,env)))return json({error:"Unauthorized."},401);
   authenticatedAdminPinRequest=true;
   const id=path.match(/^\/api\/admin\/customers\/([a-f0-9-]+)\/pin$/i)?.[1];
   const body=await request.json().catch(()=>null),pin=String(body?.pin||"");
   if(!id||!/^\d{4}$/.test(pin))return json({error:"Set a 4-digit PIN."},400);
   const customer=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(id).first();
   if(!customer)return json({error:"Customer not found."},404);
   const salt=randomHex(16),hash=await pinHash(pin,salt);
   await env.DB.prepare("INSERT INTO customer_auth (customer_id,pin_salt,pin_hash,updated_at) VALUES (?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(customer_id) DO UPDATE SET pin_salt=excluded.pin_salt,pin_hash=excluded.pin_hash,updated_at=excluded.updated_at").bind(id,salt,hash).run();
   await env.DB.prepare("DELETE FROM customer_sessions WHERE customer_id=?").bind(id).run();
   return json({ok:true,message:"Customer PIN saved. Existing sessions were signed out."});
  }
  if(path==="/api/customer/login"&&request.method==="POST"){
   const body=await request.json().catch(()=>null),code=String(body?.customerId||"").trim().toUpperCase(),pin=String(body?.pin||"");
   if(!code||!/^\d{4}$/.test(pin))return json({error:"Enter Customer ID and 4-digit PIN."},400);
   const matches=await env.DB.prepare("SELECT c.id,c.customer_code,c.full_name,a.pin_salt,a.pin_hash FROM customers c JOIN customer_auth a ON a.customer_id=c.id WHERE upper(trim(c.customer_code))=? OR lower(trim(c.full_name))=lower(?)").bind(code,code).all();
   const found=matches.results||[];
   if(found.length>1)return json({error:"More than one customer has this name. Please use the Customer Code (SIVA-XXXXXXXX)."},409);
   const customer=found[0];
   if(!customer)return json({error:"Invalid Customer ID or PIN. Enter the exact customer name or Customer Code."},401);
   const attempt=await env.DB.prepare("SELECT failed_count,locked_until FROM customer_login_attempts WHERE customer_code=?").bind(code).first();
   if(attempt?.locked_until && attempt.locked_until>new Date().toISOString())return json({error:"Too many attempts. Try again later."},429);
   const valid=(await pinHash(pin,customer.pin_salt))===customer.pin_hash;
   if(!valid){
    const fails=(attempt?.failed_count||0)+1,locked=fails>=5?new Date(Date.now()+15*60*1000).toISOString():null;
    await env.DB.prepare("INSERT INTO customer_login_attempts (customer_code,failed_count,locked_until,updated_at) VALUES (?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(customer_code) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at").bind(code,fails,locked).run();
    return json({error:"Invalid Customer ID or PIN."},401);
   }
   await env.DB.prepare("DELETE FROM customer_login_attempts WHERE customer_code=?").bind(code).run();
   const token=randomHex(32),tokenHash=await digest(token),expires=new Date(Date.now()+7*86400000).toISOString();
   await env.DB.prepare("INSERT INTO customer_sessions (token_hash,customer_id,expires_at,created_at) VALUES (?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(tokenHash,customer.id,expires).run();
   return json({ok:true,token,expiresAt:expires,customer:{customerCode:customer.customer_code,fullName:customer.full_name}});
  }
  const customer=await sessionCustomer(request,env);
  if(path==="/api/customer/logout"&&request.method==="POST"){
   const token=(request.headers.get("Authorization")||"").replace(/^Bearer /,"");
   if(token)await env.DB.prepare("DELETE FROM customer_sessions WHERE token_hash=?").bind(await digest(token)).run();
   return json({ok:true});
  }
  if(!customer)return json({error:"Please login again."},401);
  if(path==="/api/customer/me"&&request.method==="GET")return json({customer:{customerCode:customer.customer_code,fullName:customer.full_name}});
  if(path==="/api/customer/ledger"&&request.method==="GET"){
   const [services,payments]=await Promise.all([
    env.DB.prepare("SELECT service_name,fee_paise,status,created_at FROM service_records WHERE customer_id=? ORDER BY created_at DESC").bind(customer.id).all(),
    env.DB.prepare("SELECT amount_paise,method,created_at FROM payments WHERE customer_id=? ORDER BY created_at DESC").bind(customer.id).all()
   ]);
   const ss=services.results||[],ps=payments.results||[],fee=ss.reduce((n,x)=>n+x.fee_paise,0),paid=ps.reduce((n,x)=>n+x.amount_paise,0);
   return json({customer:{customerCode:customer.customer_code,fullName:customer.full_name},services:ss,payments:ps,summary:{totalFeePaise:fee,totalPaidPaise:paid,balancePaise:fee-paid}});
  }
  return json({error:"Customer endpoint not found."},404);
 }catch(e){const detail=String(e?.message||e||"Unknown error").slice(0,180);console.error("Customer portal error",detail);return authenticatedAdminPinRequest?json({error:"Customer PIN save failed.",detail},500):json({error:"Customer portal request failed."},500);}
}
