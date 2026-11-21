const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const clean = (v, max = 240) => String(v ?? "").trim().slice(0, max);
const VISA_STAGES = new Set(["enquiry","documents_pending","documents_review","appointment_pending","appointment_booked","submitted_to_authority","under_review","additional_documents_requested","decision_received","passport_returned","completed","on_hold"]);
const CRUISE_STAGES = new Set(["profile_created","cv_pending","cv_ready","application_prepared","application_submitted","employer_review","interview_scheduled","interview_completed","offer_received","medical_or_documents","closed","on_hold"]);
const CV_STAGES = new Set(["cv_pending","cv_in_progress","cv_ready"]);
const id = () => crypto.randomUUID();
const isoNow = () => new Date().toISOString();
const safeUrl = (v) => { const s=clean(v,500); if(!s)return null; try { const u=new URL(s); return u.protocol==="https:"?u.toString():null; } catch { return null; } };
const moneyless = (v,max=240) => clean(v,max);
async function adminOk(request, env) {
  const expected=String(env.ADMIN_API_TOKEN||""), supplied=(request.headers.get("Authorization")||"").replace(/^Bearer /,"");
  if(!expected||!supplied||expected.length!==supplied.length)return false;
  let diff=0; for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^supplied.charCodeAt(i);
  return diff===0;
}
async function digest(v){ const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""); }
async function customerFromSession(request,env){
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer /,""); if(!token)return null;
  return await env.DB.prepare("SELECT c.id,c.customer_code,c.full_name FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=? AND s.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(await digest(token)).first();
}
async function addUpdate(env,customerId,type,recordId,stage,note,visible=true){
  await env.DB.prepare("INSERT INTO tracking_updates (id,customer_id,record_type,record_id,stage,note,visible_to_customer) VALUES (?,?,?,?,?,?,?)")
    .bind(id(),customerId,type,recordId,stage,clean(note,1000)||null,visible?1:0).run();
}
async function listAdmin(env,customerId){
  const [visa,cruise]=await Promise.all([
    env.DB.prepare("SELECT * FROM visa_applications WHERE customer_id=? ORDER BY updated_at DESC").bind(customerId).all(),
    env.DB.prepare("SELECT * FROM cruise_applications WHERE customer_id=? ORDER BY updated_at DESC").bind(customerId).all()
  ]);
  return {visa:visa.results||[],cruise:cruise.results||[]};
}
export async function handleTrackingRequest(request,env){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(!path.startsWith("/api/admin/tracking")&&!path.startsWith("/api/customer/tracking"))return null;
  if(method==="OPTIONS")return new Response(null,{status:204});
  if(!env.DB)return json({error:"Database is not configured."},503);
  try{
    if(path.startsWith("/api/admin/tracking")){
      if(!(await adminOk(request,env)))return json({error:"Unauthorized."},401);
      if(path==="/api/admin/tracking"&&method==="GET"){
        const customerId=clean(url.searchParams.get("customerId"),80);
        if(!customerId)return json({error:"Select a customer."},400);
        const customer=await env.DB.prepare("SELECT id,customer_code,full_name,phone FROM customers WHERE id=?").bind(customerId).first();
        if(!customer)return json({error:"Customer not found."},404);
        return json({customer,...await listAdmin(env,customerId)});
      }
      if(path==="/api/admin/tracking/visa"&&method==="POST"){
        const b=await request.json().catch(()=>null); if(!b)return json({error:"Valid JSON required."},400);
        const customerId=clean(b.customerId,80),country=clean(b.destinationCountry,80),visaType=clean(b.visaType,80),stage=clean(b.stage,40)||"enquiry";
        if(!customerId||!country||!visaType||!VISA_STAGES.has(stage))return json({error:"Customer, destination, visa type and valid stage are required."},400);
        const c=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first(); if(!c)return json({error:"Customer not found."},404);
        const appId=id(),ref=clean(b.applicationReference,100),portal=safeUrl(b.officialPortalUrl);
        await env.DB.prepare("INSERT INTO visa_applications (id,customer_id,destination_country,visa_type,travel_purpose,application_reference,official_portal_url,official_status,internal_stage,submitted_on,next_update_due,admin_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(appId,customerId,country,visaType,clean(b.travelPurpose,100)||null,ref||null,portal,clean(b.officialStatus,180)||null,stage,clean(b.submittedOn,20)||null,clean(b.nextUpdateDue,20)||null,clean(b.adminNotes,1500)||null).run();
        await addUpdate(env,customerId,"visa",appId,stage,clean(b.customerNote,1000)||"Visa assistance record created.");
        return json({ok:true,id:appId},201);
      }
      if(path==="/api/admin/tracking/cruise"&&method==="POST"){
        const b=await request.json().catch(()=>null); if(!b)return json({error:"Valid JSON required."},400);
        const customerId=clean(b.customerId,80),role=clean(b.targetRole,120),stage=clean(b.stage,40)||"profile_created",cv=clean(b.cvStage,40)||"cv_pending";
        if(!customerId||!role||!CRUISE_STAGES.has(stage)||!CV_STAGES.has(cv))return json({error:"Customer, target role and valid application/CV stages are required."},400);
        const c=await env.DB.prepare("SELECT id FROM customers WHERE id=?").bind(customerId).first(); if(!c)return json({error:"Customer not found."},404);
        const appId=id();
        await env.DB.prepare("INSERT INTO cruise_applications (id,customer_id,target_role,preferred_company,cv_stage,application_stage,employer_reference,applied_on,interview_on,admin_notes) VALUES (?,?,?,?,?,?,?,?,?,?)")
          .bind(appId,customerId,role,clean(b.preferredCompany,120)||null,cv,stage,clean(b.employerReference,100)||null,clean(b.appliedOn,20)||null,clean(b.interviewOn,20)||null,clean(b.adminNotes,1500)||null).run();
        await addUpdate(env,customerId,"cruise",appId,stage,clean(b.customerNote,1000)||"Cruise career assistance record created.");
        return json({ok:true,id:appId},201);
      }
      const vm=path.match(/^\/api\/admin\/tracking\/visa\/([a-f0-9-]+)$/i);
      if(vm&&method==="PATCH"){
        const b=await request.json().catch(()=>null); if(!b)return json({error:"Valid JSON required."},400);
        const stage=clean(b.stage,40); if(!VISA_STAGES.has(stage))return json({error:"Invalid visa stage."},400);
        const old=await env.DB.prepare("SELECT id,customer_id FROM visa_applications WHERE id=?").bind(vm[1]).first(); if(!old)return json({error:"Visa application not found."},404);
        await env.DB.prepare("UPDATE visa_applications SET internal_stage=?,official_status=?,official_portal_url=?,application_reference=?,submitted_on=?,next_update_due=?,admin_notes=?,updated_at=? WHERE id=?")
          .bind(stage,clean(b.officialStatus,180)||null,safeUrl(b.officialPortalUrl),clean(b.applicationReference,100)||null,clean(b.submittedOn,20)||null,clean(b.nextUpdateDue,20)||null,clean(b.adminNotes,1500)||null,isoNow(),vm[1]).run();
        await addUpdate(env,old.customer_id,"visa",vm[1],stage,clean(b.customerNote,1000)||"Visa application progress updated.",b.visibleToCustomer!==false);
        return json({ok:true});
      }
      const cm=path.match(/^\/api\/admin\/tracking\/cruise\/([a-f0-9-]+)$/i);
      if(cm&&method==="PATCH"){
        const b=await request.json().catch(()=>null); if(!b)return json({error:"Valid JSON required."},400);
        const stage=clean(b.stage,40),cv=clean(b.cvStage,40);
        if(!CRUISE_STAGES.has(stage)||!CV_STAGES.has(cv))return json({error:"Invalid cruise/CV stage."},400);
        const old=await env.DB.prepare("SELECT id,customer_id FROM cruise_applications WHERE id=?").bind(cm[1]).first(); if(!old)return json({error:"Cruise application not found."},404);
        await env.DB.prepare("UPDATE cruise_applications SET application_stage=?,cv_stage=?,employer_reference=?,applied_on=?,interview_on=?,admin_notes=?,updated_at=? WHERE id=?")
          .bind(stage,cv,clean(b.employerReference,100)||null,clean(b.appliedOn,20)||null,clean(b.interviewOn,20)||null,clean(b.adminNotes,1500)||null,isoNow(),cm[1]).run();
        await addUpdate(env,old.customer_id,"cruise",cm[1],stage,clean(b.customerNote,1000)||"Cruise application progress updated.",b.visibleToCustomer!==false);
        return json({ok:true});
      }
      const dm=path.match(/^\/api\/admin\/tracking\/visa\/([a-f0-9-]+)\/documents$/i);
      if(dm&&method==="POST"){
        const b=await request.json().catch(()=>null); if(!b)return json({error:"Valid JSON required."},400);
        const name=clean(b.documentName,100),status=clean(b.status,30)||"pending";
        if(!name||!["pending","received","verified","needs_update","not_required"].includes(status))return json({error:"Enter a document name and valid status."},400);
        const visa=await env.DB.prepare("SELECT id FROM visa_applications WHERE id=?").bind(dm[1]).first(); if(!visa)return json({error:"Visa application not found."},404);
        await env.DB.prepare("INSERT INTO visa_document_checklist (id,visa_id,document_name,document_status,customer_note) VALUES (?,?,?,?,?)")
          .bind(id(),dm[1],name,status,clean(b.customerNote,300)||null).run();
        return json({ok:true});
      }
      return json({error:"Tracking endpoint not found."},404);
    }
    if(path==="/api/customer/tracking"&&method==="GET"){
      const customer=await customerFromSession(request,env); if(!customer)return json({error:"Please login again."},401);
      const [visa,cruise,updates]=await Promise.all([
        env.DB.prepare("SELECT id,destination_country,visa_type,travel_purpose,official_portal_url,official_status,internal_stage,submitted_on,next_update_due,updated_at,CASE WHEN application_reference IS NULL OR application_reference='' THEN NULL ELSE '••••' || substr(application_reference,-4) END AS masked_reference FROM visa_applications WHERE customer_id=? ORDER BY updated_at DESC").bind(customer.id).all(),
        env.DB.prepare("SELECT id,target_role,preferred_company,cv_stage,application_stage,applied_on,interview_on,updated_at FROM cruise_applications WHERE customer_id=? ORDER BY updated_at DESC").bind(customer.id).all(),
        env.DB.prepare("SELECT record_type,record_id,stage,note,created_at FROM tracking_updates WHERE customer_id=? AND visible_to_customer=1 ORDER BY created_at DESC LIMIT 100").bind(customer.id).all()
      ]);
      const visaRows=visa.results||[], docs={};
      for(const v of visaRows){const r=await env.DB.prepare("SELECT document_name,document_status,customer_note,updated_at FROM visa_document_checklist WHERE visa_id=? ORDER BY document_name").bind(v.id).all();docs[v.id]=r.results||[];}
      return json({customer:{customerCode:customer.customer_code,fullName:customer.full_name},visa:visaRows,cruise:cruise.results||[],updates:updates.results||[],visaDocuments:docs});
    }
    return json({error:"Tracking endpoint not found."},404);
  }catch(e){
    console.error("SIVA tracking error:",String(e?.message||e).slice(0,180));
    return json({error:"Tracking request failed. Check the D1 migration and Worker logs."},500);
  }
}
