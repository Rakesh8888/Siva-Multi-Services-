const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...headers }
});
const clean = (v,max=180) => String(v ?? "").trim().slice(0,max);
const id = () => crypto.randomUUID();
const enc = (v) => new TextEncoder().encode(v);
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
async function passwordHash(password,salt=b64(crypto.getRandomValues(new Uint8Array(16)))) {
  const key=await crypto.subtle.importKey("raw",enc(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc(salt),iterations:210000,hash:"SHA-256"},key,256);
  return salt+"."+b64(bits);
}
async function passwordVerify(password,stored) {
  const [salt]=stored.split(".");
  return (await passwordHash(password,salt))===stored;
}
async function sign(value,secret) {
  const key=await crypto.subtle.importKey("raw",enc(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64(await crypto.subtle.sign("HMAC",key,enc(value)));
}
async function makeSession(user,env) {
  const payload=b64(enc(JSON.stringify({sub:user.id,school:env.SCHOOL_ID,role:user.role,exp:Date.now()+8*60*60*1000})));
  return payload+"."+await sign(payload,env.SESSION_SECRET);
}
async function currentUser(request,env) {
  const cookie=request.headers.get("cookie")||"";
  const token=(cookie.match(/(?:^|;\s*)school_session=([^;]+)/)||[])[1];
  if(!token||!env.SESSION_SECRET||!env.SCHOOL_ID)return null;
  const [payload,sig]=token.split(".");
  if(!payload||!sig||sig!==await sign(payload,env.SESSION_SECRET))return null;
  try {
    const data=JSON.parse(new TextDecoder().decode(unb64(payload)));
    if(data.exp<Date.now()||data.school!==env.SCHOOL_ID)return null;
    return await env.DB.prepare("SELECT id,school_id,full_name,email,role,active FROM users WHERE id=? AND school_id=? AND active=1").bind(data.sub,env.SCHOOL_ID).first();
  } catch { return null; }
}
async function body(request) { try { return await request.json(); } catch { return {}; } }
const roles = {
  admin:["*"],
  teacher:["students:read","classes:read","attendance:read","attendance:write","exams:read","exams:write","notices:read","notices:write"],
  accountant:["students:read","classes:read","fees:read","fees:write","notices:read"],
  parent:["portal:read","notices:read"],
  student:["portal:read","notices:read"]
};
function allowed(user,permission) { const list=roles[user.role]||[]; return list.includes("*")||list.includes(permission); }
function requireRole(user,permission) { return allowed(user,permission) ? null : json({error:"You do not have permission for this action."},403); }

export default {
 async fetch(request,env) {
  const url=new URL(request.url), path=url.pathname, method=request.method;
  if(!env.DB||!env.SCHOOL_ID) return json({error:"School ERP is not configured."},503);
  if(path==="/api/health"&&method==="GET") return json({ok:true,product:"White-label School CRM & ERP"});
  if(path==="/api/setup"&&method==="POST") {
    if(!env.SETUP_KEY) return json({error:"Initial setup is disabled."},403);
    const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE school_id=?").bind(env.SCHOOL_ID).first();
    const b=await body(request);
    if(count.n>0) return json({error:"Setup has already been completed."},409);
    if(!b.setupKey||b.setupKey!==env.SETUP_KEY) return json({error:"Invalid setup key."},403);
    const name=clean(b.fullName,120),email=clean(b.email,180).toLowerCase(),password=String(b.password||"");
    if(!name||!email.includes("@")||password.length<12) return json({error:"Enter a name, valid email, and password of at least 12 characters."},400);
    const userId=id(),hash=await passwordHash(password);
    await env.DB.prepare("INSERT INTO users(id,school_id,full_name,email,password_hash,role) VALUES(?,?,?,?,?,'admin')").bind(userId,env.SCHOOL_ID,name,email,hash).run();
    return json({ok:true,message:"Administrator created. Remove SETUP_KEY from Worker secrets now."},201);
  }
  if(path==="/api/login"&&method==="POST") {
    const b=await body(request),email=clean(b.email,180).toLowerCase(),password=String(b.password||"");
    const user=await env.DB.prepare("SELECT * FROM users WHERE school_id=? AND email=? AND active=1").bind(env.SCHOOL_ID,email).first();
    if(!user||!(await passwordVerify(password,user.password_hash))) return json({error:"Email or password is incorrect."},401);
    const token=await makeSession(user,env);
    return json({ok:true,user:{id:user.id,name:user.full_name,email:user.email,role:user.role}},200,{
      "set-cookie":"school_session="+token+"; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800"
    });
  }
  if(path==="/api/logout"&&method==="POST") return json({ok:true},200,{"set-cookie":"school_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"});
  const user=await currentUser(request,env);
  if(!user) return json({error:"Please sign in to continue."},401);
  if(path==="/api/me"&&method==="GET") return json({user:{id:user.id,name:user.full_name,email:user.email,role:user.role}});
  const school=env.SCHOOL_ID;
  if(path==="/api/classes"&&method==="GET") {
    const denied=requireRole(user,"classes:read"); if(denied)return denied;
    const r=await env.DB.prepare("SELECT id,class_name,section,academic_year FROM classes WHERE school_id=? ORDER BY class_name,section").bind(school).all();
    return json({items:r.results});
  }
  if(path==="/api/classes"&&method==="POST") {
    const denied=requireRole(user,"*"); if(denied)return denied;
    const b=await body(request),name=clean(b.className,60),section=clean(b.section,30),year=clean(b.academicYear,20);
    if(!name||!year)return json({error:"Class name and academic year are required."},400);
    const classId=id();
    try { await env.DB.prepare("INSERT INTO classes(id,school_id,class_name,section,academic_year) VALUES(?,?,?,?,?)").bind(classId,school,name,section,year).run(); }
    catch { return json({error:"This class and section already exists for that academic year."},409); }
    return json({ok:true,id:classId},201);
  }
  if(path==="/api/students"&&method==="GET") {
    const denied=requireRole(user,user.role==="parent"||user.role==="student"?"portal:read":"students:read"); if(denied)return denied;
    const q=clean(url.searchParams.get("q"),80);
    let r;
    if(user.role==="parent"||user.role==="student") {
      r=await env.DB.prepare("SELECT s.id,s.admission_no,s.first_name,s.last_name,s.class_id,s.status FROM students s JOIN users u ON u.linked_student_id=s.id WHERE u.id=? AND u.school_id=? AND s.school_id=?").bind(user.id,school,school).all();
    } else {
      r=await env.DB.prepare("SELECT id,admission_no,first_name,last_name,class_id,status FROM students WHERE school_id=? AND (?='' OR admission_no LIKE ? OR first_name LIKE ? OR last_name LIKE ?) ORDER BY first_name LIMIT 300").bind(school,q,"%"+q+"%","%"+q+"%","%"+q+"%").all();
    }
    return json({items:r.results});
  }
  if(path==="/api/students"&&method==="POST") {
    const denied=requireRole(user,"*"); if(denied)return denied;
    const b=await body(request),admission=clean(b.admissionNo,60),first=clean(b.firstName,80),last=clean(b.lastName,80);
    if(!admission||!first)return json({error:"Admission number and first name are required."},400);
    const studentId=id();
    try {
      await env.DB.prepare("INSERT INTO students(id,school_id,admission_no,first_name,last_name,dob,gender,class_id,guardian_name,guardian_phone,guardian_email,address,joined_on) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(studentId,school,admission,first,last,clean(b.dob,10)||null,clean(b.gender,20)||null,clean(b.classId,36)||null,clean(b.guardianName,120),clean(b.guardianPhone,30),clean(b.guardianEmail,180),clean(b.address,500),clean(b.joinedOn,10)||null).run();
    } catch { return json({error:"Admission number already exists or class is invalid."},409); }
    await env.DB.prepare("INSERT INTO audit_log(id,school_id,user_id,action,entity_type,entity_id) VALUES(?,?,?,?,?,?)").bind(id(),school,user.id,"created","student",studentId).run();
    return json({ok:true,id:studentId},201);
  }
  if(path==="/api/attendance"&&method==="GET") {
    const denied=requireRole(user,"attendance:read"); if(denied)return denied;
    const date=clean(url.searchParams.get("date"),10);
    const r=await env.DB.prepare("SELECT a.id,a.student_id,a.attendance_date,a.status,a.note,s.admission_no,s.first_name,s.last_name FROM attendance a JOIN students s ON s.id=a.student_id AND s.school_id=a.school_id WHERE a.school_id=? AND a.attendance_date=? ORDER BY s.first_name").bind(school,date).all();
    return json({items:r.results});
  }
  if(path==="/api/attendance"&&method==="POST") {
    const denied=requireRole(user,"attendance:write"); if(denied)return denied;
    const b=await body(request),studentId=clean(b.studentId,36),date=clean(b.date,10),status=clean(b.status,12);
    if(!studentId||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!["present","absent","late","leave"].includes(status))return json({error:"Student, valid date and attendance status are required."},400);
    const exists=await env.DB.prepare("SELECT id FROM students WHERE id=? AND school_id=?").bind(studentId,school).first();
    if(!exists)return json({error:"Student not found."},404);
    await env.DB.prepare("INSERT INTO attendance(id,school_id,student_id,attendance_date,status,marked_by,note) VALUES(?,?,?,?,?,?,?) ON CONFLICT(school_id,student_id,attendance_date) DO UPDATE SET status=excluded.status,marked_by=excluded.marked_by,note=excluded.note").bind(id(),school,studentId,date,status,user.id,clean(b.note,250)).run();
    return json({ok:true});
  }
  if(path==="/api/fees"&&method==="GET") {
    const denied=requireRole(user,user.role==="parent"||user.role==="student"?"portal:read":"fees:read"); if(denied)return denied;
    const r=await env.DB.prepare("SELECT f.id,f.invoice_no,f.fee_type,f.amount_paise,f.due_date,f.status,f.academic_year,s.admission_no,s.first_name,s.last_name,COALESCE((SELECT SUM(p.amount_paise) FROM fee_payments p WHERE p.invoice_id=f.id AND p.school_id=f.school_id),0) AS paid_paise FROM fee_invoices f JOIN students s ON s.id=f.student_id AND s.school_id=f.school_id WHERE f.school_id=? ORDER BY f.created_at DESC LIMIT 300").bind(school).all();
    return json({items:r.results});
  }
  if(path==="/api/fees"&&method==="POST") {
    const denied=requireRole(user,"fees:write"); if(denied)return denied;
    const b=await body(request),studentId=clean(b.studentId,36),feeType=clean(b.feeType,80),invoiceNo=clean(b.invoiceNo,60),amount=Math.round(Number(b.amount)*100);
    if(!studentId||!feeType||!invoiceNo||!Number.isSafeInteger(amount)||amount<=0)return json({error:"Student, invoice number, fee type and valid amount are required."},400);
    const student=await env.DB.prepare("SELECT id FROM students WHERE id=? AND school_id=?").bind(studentId,school).first();
    if(!student)return json({error:"Student not found."},404);
    try { await env.DB.prepare("INSERT INTO fee_invoices(id,school_id,student_id,invoice_no,fee_type,amount_paise,due_date,academic_year) VALUES(?,?,?,?,?,?,?,?)").bind(id(),school,studentId,invoiceNo,feeType,amount,clean(b.dueDate,10)||null,clean(b.academicYear,20)).run(); }
    catch { return json({error:"Invoice number already exists or details are invalid."},409); }
    return json({ok:true},201);
  }
  if(path==="/api/fee-payments"&&method==="POST") {
    const denied=requireRole(user,"fees:write"); if(denied)return denied;
    const b=await body(request),invoiceId=clean(b.invoiceId,36),amount=Math.round(Number(b.amount)*100),methodName=clean(b.method,30),receipt=clean(b.receiptNo,60);
    if(!invoiceId||!Number.isSafeInteger(amount)||amount<=0||!methodName||!receipt)return json({error:"Invoice, valid amount, payment method and receipt number are required."},400);
    const invoice=await env.DB.prepare("SELECT id,amount_paise,status FROM fee_invoices WHERE id=? AND school_id=? AND status!='cancelled'").bind(invoiceId,school).first();
    if(!invoice)return json({error:"Invoice not found."},404);
    const paid=await env.DB.prepare("SELECT COALESCE(SUM(amount_paise),0) AS total FROM fee_payments WHERE invoice_id=? AND school_id=?").bind(invoiceId,school).first();
    if(paid.total+amount>invoice.amount_paise)return json({error:"Payment exceeds the remaining invoice balance."},400);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO fee_payments(id,school_id,invoice_id,amount_paise,payment_method,receipt_no,reference,received_by) VALUES(?,?,?,?,?,?,?,?)").bind(id(),school,invoiceId,amount,methodName,receipt,clean(b.reference,100),user.id),
      env.DB.prepare("UPDATE fee_invoices SET status=? WHERE id=? AND school_id=?").bind(paid.total+amount===invoice.amount_paise?"paid":"partial",invoiceId,school)
    ]);
    return json({ok:true},201);
  }
  if(path==="/api/notices"&&method==="GET") {
    const denied=requireRole(user,"notices:read"); if(denied)return denied;
    const r=await env.DB.prepare("SELECT id,title,body,audience,published,created_at FROM notices WHERE school_id=? AND (published=1 OR ?='admin') ORDER BY created_at DESC LIMIT 100").bind(school,user.role).all();
    return json({items:r.results});
  }
  if(path==="/api/notices"&&method==="POST") {
    const denied=requireRole(user,"notices:write"); if(denied)return denied;
    const b=await body(request),title=clean(b.title,160),text=clean(b.body,4000),audience=clean(b.audience,20);
    if(!title||!text||!["all","teachers","parents","students"].includes(audience))return json({error:"Title, message and valid audience are required."},400);
    await env.DB.prepare("INSERT INTO notices(id,school_id,title,body,audience,published,created_by) VALUES(?,?,?,?,?,?,?)").bind(id(),school,title,text,audience,b.published?1:0,user.id).run();
    return json({ok:true},201);
  }
  if(path==="/api/exams"&&method==="GET") {
    const denied=requireRole(user,"exams:read"); if(denied)return denied;
    const r=await env.DB.prepare("SELECT e.id,e.exam_name,e.subject,e.exam_date,e.max_marks,e.academic_year,c.class_name,c.section FROM exams e JOIN classes c ON c.id=e.class_id AND c.school_id=e.school_id WHERE e.school_id=? ORDER BY e.exam_date DESC LIMIT 200").bind(school).all();
    return json({items:r.results});
  }
  if(path==="/api/exams"&&method==="POST") {
    const denied=requireRole(user,"exams:write"); if(denied)return denied;
    const b=await body(request),name=clean(b.examName,100),classId=clean(b.classId,36),subject=clean(b.subject,80),max=Number(b.maxMarks);
    if(!name||!classId||!subject||!Number.isFinite(max)||max<=0)return json({error:"Exam, class, subject and valid maximum marks are required."},400);
    const cls=await env.DB.prepare("SELECT id FROM classes WHERE id=? AND school_id=?").bind(classId,school).first();
    if(!cls)return json({error:"Class not found."},404);
    await env.DB.prepare("INSERT INTO exams(id,school_id,exam_name,class_id,subject,exam_date,max_marks,academic_year) VALUES(?,?,?,?,?,?,?,?)").bind(id(),school,name,classId,subject,clean(b.examDate,10)||null,max,clean(b.academicYear,20)).run();
    return json({ok:true},201);
  }
  return json({error:"Not found."},404);
 }
};
