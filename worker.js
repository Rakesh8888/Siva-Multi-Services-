const GEMINI_MODEL = "gemini-3.5-flash-lite";

const RAG_EMBEDDING_MODEL = "@cf/baai/bge-m3";

async function embedTexts(env, texts) {
  if (!env.AI) throw new Error("Cloudflare Workers AI binding AI is missing");
  const result = await env.AI.run(RAG_EMBEDDING_MODEL, { text: texts });
  const vectors = result?.data || result?.result?.data;
  if (!Array.isArray(vectors) || vectors.length !== texts.length) throw new Error("Embedding model returned an unexpected response");
  return vectors;
}

async function retrieveKnowledge(message, env) {
  if (!env.AI || !env.SIVA_KNOWLEDGE) return "";
  try {
    const [vector] = await embedTexts(env, [message]);
    const matches = await env.SIVA_KNOWLEDGE.query(vector, { topK: 5, returnMetadata: "all" });
    const snippets = (matches?.matches || [])
      .filter(item => Number(item.score || 0) >= 0.35 && item.metadata?.text)
      .map(item => String(item.metadata.text).slice(0, 1800));
    return snippets.length ? "\\n\\nVERIFIED BUSINESS KNOWLEDGE (use only when relevant; do not invent beyond it):\\n" + snippets.join("\\n---\\n") : "";
  } catch (error) {
    console.error("SIVA RAG retrieval skipped:", String(error?.message || error).slice(0, 180));
    return "";
  }
}

async function handleKnowledgeIngest(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, request);
  if (!env.RAG_ADMIN_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.RAG_ADMIN_TOKEN) {
    return jsonResponse({ error: "Unauthorized" }, 401, request);
  }
  if (!env.AI || !env.SIVA_KNOWLEDGE) return jsonResponse({ error: "Workers AI or Vectorize binding is missing" }, 503, request);
  try {
    const body = await request.json();
    const docs = Array.isArray(body?.documents) ? body.documents : [];
    if (!docs.length || docs.length > 100) return jsonResponse({ error: "Send 1 to 100 documents" }, 400, request);
    const cleaned = docs.map((doc, i) => ({
      id: String(doc?.id || "siva-" + Date.now() + "-" + i).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64),
      text: String(doc?.text || "").trim().slice(0, 1800),
      source: String(doc?.source || "SIVA Multi Services").slice(0, 120)
    })).filter(doc => doc.text);
    if (!cleaned.length) return jsonResponse({ error: "No usable document text was supplied" }, 400, request);
    const embeddings = await embedTexts(env, cleaned.map(doc => doc.text));
    const vectors = cleaned.map((doc, i) => ({
      id: doc.id,
      values: embeddings[i],
      metadata: { text: doc.text, source: doc.source }
    }));
    await env.SIVA_KNOWLEDGE.upsert(vectors);
    return jsonResponse({ ok: true, indexed: vectors.length, model: RAG_EMBEDDING_MODEL }, 200, request);
  } catch (error) {
    console.error("SIVA knowledge ingestion failed:", String(error?.message || error).slice(0, 200));
    return jsonResponse({ error: "Knowledge indexing failed. Check Vectorize dimensions and Workers AI binding." }, 500, request);
  }
}


function normalizeLanguage(message, requestedLanguage) {
  const text = String(message || "");
  const requested = String(requestedLanguage || "").trim().toLowerCase();
  const languageAliases = {
    "en":"English","english":"English","en-in":"English",
    "te":"Telugu","telugu":"Telugu","te-in":"Telugu",
    "hi":"Hindi","hindi":"Hindi","hi-in":"Hindi",
    "ta":"Tamil","tamil":"Tamil","ta-in":"Tamil",
    "kn":"Kannada","kannada":"Kannada","kn-in":"Kannada",
    "ml":"Malayalam","malayalam":"Malayalam","ml-in":"Malayalam",
    "ur":"Urdu","urdu":"Urdu","ur-in":"Urdu",
    "ar":"Arabic","arabic":"Arabic","ar-sa":"Arabic","ar-kw":"Arabic",
    "fr":"French","french":"French","fr-fr":"French","fr-ca":"French",
    "de":"German","german":"German","de-de":"German","de-ch":"German","de-at":"German",
    "es":"Spanish","spanish":"Spanish","es-es":"Spanish",
    "pt":"Portuguese","portuguese":"Portuguese","pt-pt":"Portuguese",
    "ru":"Russian","russian":"Russian","ru-ru":"Russian",
    "zh-cn":"Chinese (Simplified)","zh":"Chinese (Simplified)","chinese":"Chinese (Simplified)",
    "ja":"Japanese","japanese":"Japanese","ja-jp":"Japanese",
    "ko":"Korean","korean":"Korean","ko-kr":"Korean",
    "id":"Indonesian","indonesian":"Indonesian","id-id":"Indonesian",
    "bn":"Bengali","bengali":"Bengali","bn-in":"Bengali",
    "mr":"Marathi","marathi":"Marathi","mr-in":"Marathi",
    "pa":"Punjabi","punjabi":"Punjabi","pa-in":"Punjabi"
  };
  const scriptRules = [
    [/[ఀ-౿]/, "Telugu"], [/[ऀ-ॿ]/, "Hindi"],
    [/[஀-௿]/, "Tamil"], [/[ಀ-೿]/, "Kannada"],
    [/[ഀ-ൿ]/, "Malayalam"], [/[ঀ-৿]/, "Bengali"],
    [/[਀-੿]/, "Punjabi"], [/[؀-ۿ]/, "Arabic"],
    [/[一-鿿]/, "Chinese (Simplified)"], [/[぀-ヿ]/, "Japanese"],
    [/[가-힯]/, "Korean"]
  ];
  if (requested === "auto" || requested === "auto detect" || requested === "") {
    for (const [pattern, name] of scriptRules) if (new RegExp(pattern).test(text)) return name;
    return "Auto Detect";
  }
  if (languageAliases[requested]) return languageAliases[requested];
  for (const [pattern, name] of scriptRules) if (new RegExp(pattern).test(text)) return name;
  return "English";
}
const SYSTEM_PROMPT = (language) => `You are SIVA MULTI SERVICES AI, the virtual customer-enquiry assistant for SIVA Multi Services.

LANGUAGE:
- Reply in ${language === "Auto Detect" ? "the same language the user used in their latest message (detect it yourself, including Romanized Telugu/Hindi and mixed Telugu-English)" : language} only, using its normal writing system. Telugu means natural Telugu script, not transliterated Telugu.
- Always identify the language of the latest user message yourself. If Telugu is written in Latin letters (for example, “nenu ela cheyali”), answer in natural Telugu script. If Hindi is written in Latin letters, answer in Hindi script. If mixed, use the dominant language. Keep official names, URLs, job titles and technical terms unchanged where useful.
- Do not begin in one language and switch to another unless the user asks.

ROLE:
Help with tours and travel, visa-application assistance, overseas-job application assistance, skilled and blue-collar jobs, and cruise-ship jobs. SIVA Multi Services provides enquiry and application assistance; do not imply it is an employer or an authorized recruiter unless verified.

SOFTWARE RESELLER AND SCHOOL SOFTWARE SUPPORT
- Explain that SIVA Multi Services can provide software reseller/referral assistance and help customers explore software products, subscriptions, licenses, and school-management/parent communication apps (including school app solutions) where an authorized vendor/reseller arrangement and availability are confirmed.
- Help customers understand the intended use, key features, compatibility, setup steps, pricing model, trial/demo availability, renewal terms, support, and cancellation/refund terms. Ask what type of software they need and for how many users/schools if necessary.
- Do not claim SIVA Multi Services is an authorized reseller, official partner, software publisher, or developer for any brand unless that status is verified. Do not invent product names, licenses, discounts, prices, free plans, demos, integrations, or vendor partnerships.
- Before recommending a purchase, advise the customer to verify the vendor's official website, license scope, renewal price, device/user limits, data privacy, support, and refund policy. Never ask for passwords, OTPs, or payment-card details.
- If a customer asks what SIVA Multi Services offers, list software reselling/support and school software/app solutions alongside tours and travel, visa application assistance, and limited job-application/CV/interview guidance. Clearly distinguish services currently available from options that require vendor confirmation.

ACCURACY:
- Answer the exact question first, in concise, simple steps.
- For questions about SIVA Multi Services, use only facts explicitly stated in this system prompt or verified in the website content. Do not fill gaps with assumptions.
- If a requested company detail, service, fee, vacancy, employer, timeline, availability, or policy is not confirmed in the information available to you, clearly say you do not have verified information. Do not guess or make up an answer.
- When you cannot give a verified answer, append this exact marker at the very end of your reply: [[SIVA_WHATSAPP_HANDOFF]]. Do not explain or alter the marker. The website will turn it into a WhatsApp contact link.
- Never invent current vacancies, employers, salary figures, visa rules, prices, fees, interview calls, approvals, partnerships, or bookings.
- Separate confirmed facts from examples or estimates. If information is not available or current verification is needed, say so plainly.
- Never promise a job, interview, visa, immigration result, or booking.
- For current job/visa/travel details, direct users to the official employer, airline, cruise company, or government source when available.
- If the user's request is unclear, ask one short clarifying question.
- Do not claim an application, booking, payment, or message has been submitted unless that action was actually verified.

STYLE AND COST:
- Be friendly, patient, and practical for beginners.
- Prefer short paragraphs and numbered steps; avoid repetition and unnecessary background.
- Understand common typos, informal speech, Indian English, and mixed-language messages.
- Do not display, repeat, or reveal the business WhatsApp number or phone number in AI chatbot replies, even if the user asks for contact details. If users want to contact the business, direct them to the website Contact Us section or its WhatsApp enquiry button without stating the number.
- VISA SERVICE ANSWERS: When asked “What visa services do you provide?”, answer in plain, natural wording. Say “SIVA Multi Services provides visa application assistance and travel guidance” and list only relevant categories as assistance, such as tourist/visitor visas, business travel visas, and work-visa information, subject to destination-country rules and eligibility. Do not claim that every visa type is available or that the company issues/approves visas.
- VOICE PRONUNCIATION: Never repeat garbled speech-recognition fragments or pronounce abbreviations letter by letter when a clear full name is available. Do not say “S R S”, “A S H R E S”, “star star visa services”, or similar malformed phrases. Say the complete brand/service phrase “SIVA Multi Services visa assistance” clearly. If uncertain what the user said, ask a short clarification instead of guessing.
- Do not describe visa assistance as “visa services” in a way that implies SIVA Multi Services is a government visa office, embassy, consulate, or visa-issuing authority.

CRUISE SHIP JOB GUIDANCE AND LIMITED ASSISTANCE
- Explain SIVA Multi Services' current scope honestly: it provides general guidance and separately chargeable assistance only for (1) helping a customer navigate/fill a job application form on the official employer website, (2) CV/resume preparation, and (3) interview preparation/coaching. These are separate optional services. Do not quote or invent prices; fees have not been published yet and should be communicated only after they are formally set and disclosed to the customer before service begins.
- Customers themselves choose the vacancy, verify eligibility, review the information, and submit/confirm the application on the employer's official website. Do not claim SIVA Multi Services independently recruits, places, employs, endorses, or represents cruise companies.
- SIVA Multi Services does not arrange or sell maritime courses, STCW certificates, deck/engine training, medical examinations, seafarer documents, visas, travel tickets, employment offers, or guaranteed interviews as part of this limited assistance. If asked, provide general information and direct the customer to the relevant official authority or provider. Do not claim to deliver these services.
- The customer is responsible for the truth and accuracy of all information and documents they provide, and should personally review any form before submitting it. Never ask for passwords, OTPs, or unnecessary sensitive documents.
- When relevant, provide these cruise company Careers pages as links for convenience:
  Royal Caribbean Group: https://careers.royalcaribbeangroup.com/careers/
  Carnival Cruise Line: https://jobs.carnival.com/
  MSC Cruises: https://careers.msccruises.com/gb/en
  Norwegian Cruise Line: https://careers.ncl.com/
  Princess Cruises: https://www.princess.com/careers
- Treat URLs as starting references. If uncertain whether a link remains official or working, tell the user to navigate to Careers from the company's main official website instead.
- Explain that applications should be made through the cruise company's official Careers website or a hiring partner explicitly authorized by that company, according to that company's published process. Do not say direct application is mandatory in every case.
- Never imply SIVA Multi Services is affiliated with, endorsed by, or an authorized recruiter/partner of any cruise company unless independently verified and explicitly confirmed.
- Never invent vacancies, salaries, fees, interviews, job offers, eligibility requirements, partnerships, or recruitment status. Never guarantee employment, interview success, visa approval, or salary.
- For overseas recruitment from India, advise customers to verify recruitment channels through the Ministry of External Affairs' official guidance and eMigrate portal when relevant: https://www.mea.gov.in/oe-faq.htm and https://emigrate.gov.in/
- Whenever cruise job links or these assistance services are described, display this disclaimer in the user's selected language. In English, use:
“Disclaimer: SIVA Multi Services provides general career information and optional assistance with CV preparation, interview preparation, and navigating/filling job application forms. Each assistance service is separate and any applicable fee will be disclosed and agreed before the service starts. We do not guarantee a job, vacancy, interview, interview success, salary, visa, or employment offer. We are not affiliated with or endorsed by the cruise companies listed unless explicitly verified and confirmed. Cruise companies or their authorized hiring partners control vacancies, recruitment, application decisions, and employment offers. Customers must verify job details through official sources, provide accurate information, and review and approve applications before submission. SIVA Multi Services does not provide maritime/STCW/deck/engine courses, certificates, medicals, or recruitment/placement services through this general guidance. External links are provided for convenience; their content and availability are controlled by the respective websites. Please verify any recruitment channel before sharing documents or making payments.”
- Translate the disclaimer faithfully into Telugu, Hindi, or the user's selected language when appropriate. Do not omit it when giving cruise job links or explaining these assistance services.
- Do not say “we have no responsibility whatsoever” or imply a disclaimer guarantees immunity from legal action. Describe the service accurately and transparently; applicable law and actual conduct still matter.
`;

function corsHeaders(request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin") || "";
  // Allow the Cloudflare-hosted site itself and this repository's GitHub Pages preview.
  // Never reflect arbitrary third-party origins.
  const allowedOrigins = new Set([
    requestOrigin,
    "https://siva-global-travels-3d.vercel.app",
    "https://sivaglobaltravels.vercel.app",
    "https://rakesh8888.github.io"
  ]);
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : requestOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function jsonResponse(data, status, request) {
  return Response.json(data, {
    status,
    headers: corsHeaders(request)
  });
}


function needsCurrentResearch(message) {
  return /\b(latest|today|current|currently|now|recent|news|price|prices|fare|fares|flight status|weather|visa rules|visa requirement|job vacancy|vacancies|available jobs|deadline|official update|exchange rate)\b/i.test(message)
    || /ఇప్పటి|ప్రస్తుత|ఈరోజు|తాజా|ధరలు|విమాన ధర|వీసా నియమాలు|ఉద్యోగ ఖాళీ|నేటి వార్తలు/.test(message);
}

async function answerWithGroundedSearch(message, history, language, env) {
  if (!env.GEMINI_API_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const contents = [
      ...history.map(x => ({ role: x.role === "assistant" ? "model" : "user", parts: [{ text: x.content }] })),
      { role: "user", parts: [{ text: message }] }
    ];
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT(language) + "\n\nFor current-information questions, use Google Search grounding. State dates clearly, distinguish official sources from other sources, and do not invent a price, vacancy, visa rule, or availability. If search results do not confirm something, say so." }] },
          contents,
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 700, temperature: 0.2 }
        }),
        signal: controller.signal
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || ("Gemini grounded search HTTP " + response.status));
    const candidate = data?.candidates?.[0];
    const reply = candidate?.content?.parts?.map(part => typeof part.text === "string" ? part.text : "").join("").trim();
    if (!reply) return null;
    const grounding = candidate?.groundingMetadata;
    const sources = Array.isArray(grounding?.groundingChunks)
      ? grounding.groundingChunks.map(chunk => chunk?.web).filter(web => web?.uri && web?.title).slice(0, 5)
      : [];
    return { reply, language, research: true, sources };
  } finally {
    clearTimeout(timer);
  }
}

async function handleChat(request, env) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 64 * 1024) return jsonResponse({ error: "Chat request is too large. Please shorten your message and try again." }, 413, request);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, request);
  }
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return jsonResponse({ error: "Message is required" }, 400, request);
    if (message.length > 4000) {
      return jsonResponse({ error: "Please shorten your message to 4,000 characters or less." }, 413, request);
    }

    const language = normalizeLanguage(message, body?.language);
    const history = Array.isArray(body?.history) ? body.history
      .filter(x => x && (x.role === "user" || x.role === "assistant") && typeof x.content === "string")
      .slice(body?.spoken === true ? -2 : -4)
      .map(x => ({ role: x.role, content: x.content.slice(body?.spoken === true ? -500 : -900) })) : [];
    const ragContext = await retrieveKnowledge(message, env);
    const systemPrompt = SYSTEM_PROMPT(language) + ragContext + (body?.spoken === true
      ? "\n\nVOICE RESPONSE SPEED: This is a spoken conversation. Answer immediately and briefly in 1–3 short sentences, usually under 45 words. Put the direct answer first. Avoid long lists, headings, markdown symbols, and unnecessary introductions. Ask at most one short follow-up question."
      : "");
    const geminiContents = [
      ...history.map(x => ({
        role: x.role === "assistant" ? "model" : "user",
        parts: [{ text: x.content }]
      })),
      { role: "user", parts: [{ text: message }] }
    ];

    // Gemini with Google Search grounding for questions about changing information.
    if (env.GEMINI_API_KEY && needsCurrentResearch(message)) {
      try {
        const grounded = await answerWithGroundedSearch(message, history, language, env);
        if (grounded) return jsonResponse({ ...grounded, provider: "gemini" }, 200, request);
      } catch (error) {
        console.error("Gemini grounded search unavailable:", String(error?.message || error).slice(0, 180));
      }
    }

    let geminiProblem = env.GEMINI_API_KEY ? "Gemini request could not be completed" : "Gemini API key is not configured";
    let geminiStatus = 0;
    let geminiQuotaReached = false;
    const models = [GEMINI_MODEL, "gemini-3.1-flash-lite"];
    if (env.GEMINI_API_KEY) for (let index = 0; index < models.length; index++) {
      const model = models[index];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), body?.spoken === true ? 12000 : 20000);
      try {
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: geminiContents,
              generationConfig: {
                maxOutputTokens: body?.spoken === true ? 180 : 600,
                temperature: body?.spoken === true ? 0.2 : 0.3
              }
            }),
            signal: controller.signal
          }
        );
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const reply = data?.candidates?.[0]?.content?.parts
            ?.map(part => typeof part.text === "string" ? part.text : "")
            .join("").trim();
          if (reply) {
            return jsonResponse({ reply, language, provider: "gemini", model }, 200, request);
          }
          geminiProblem = "Gemini returned an empty answer";
        } else {
          geminiStatus = response.status;
          geminiProblem = data?.error?.message || ("Gemini HTTP " + response.status);
          geminiQuotaReached = response.status === 429 || /quota|resource exhausted|rate.?limit|billing/i.test(geminiProblem);
          console.error("Gemini AI error:", response.status, geminiProblem.slice(0, 180));
          if (geminiQuotaReached || [400, 401, 403].includes(response.status)) break;
        }
      } catch (error) {
        geminiProblem = error?.name === "AbortError" ? "Gemini request timed out" : "Gemini network error";
      } finally {
        clearTimeout(timer);
      }
      if (index === 0 && geminiQuotaReached) break;
    }

    // If Gemini is blocked in the caller's region, use the configured Groq key as a backup.
    // This keeps text, voice-message, and live-voice replies working without changing the website.
    const geminiUnavailable = !env.GEMINI_API_KEY || geminiStatus !== 0 || /timed out|network error|could not be completed|empty answer/i.test(geminiProblem);
    if (geminiUnavailable && env.GROQ_API_KEY) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), body?.spoken === true ? 12000 : 20000);
      try {
        const groqMessages = [
          { role: "system", content: systemPrompt },
          ...history.map(x => ({ role: x.role === "assistant" ? "assistant" : "user", content: x.content })),
          { role: "user", content: message }
        ];
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + env.GROQ_API_KEY
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: groqMessages,
            max_tokens: body?.spoken === true ? 180 : 600,
            temperature: body?.spoken === true ? 0.2 : 0.3
          }),
          signal: controller.signal
        });
        const groqData = await groqResponse.json().catch(() => ({}));
        if (groqResponse.ok) {
          const reply = groqData?.choices?.[0]?.message?.content?.trim();
          if (reply) return jsonResponse({ reply, language, provider: "groq", model: "llama-3.3-70b-versatile", fallback: true }, 200, request);
        }
        console.error("Groq fallback error:", groqResponse.status, String(groqData?.error?.message || "").slice(0, 180));
      } catch (error) {
        console.error("Groq fallback request failed:", String(error?.message || error).slice(0, 180));
      } finally {
        clearTimeout(timer);
      }
    }

    return jsonResponse({
      error: geminiQuotaReached
        ? "Gemini API quota or rate limit has been reached. Please try again after the limit resets."
        : "AI service is temporarily unavailable. Please try again later.",
      provider: "gemini",
      providerMessage: String(geminiProblem).slice(0, 300),
      fallbackConfigured: Boolean(env.GROQ_API_KEY),
      whatsappUrl: "https://wa.me/9182641172?text=" + encodeURIComponent("Hello Siva Multi Services, I need help with my enquiry.")
    }, !env.GEMINI_API_KEY && !env.GROQ_API_KEY ? 503 : (geminiQuotaReached ? 429 : 502), request);
  } catch (error) {
    console.error("SIVA Gemini AI request error:", String(error?.stack || error?.message || error?.name || "Unknown error").slice(0, 700));
    return jsonResponse({
      error: error?.name === "AbortError"
        ? "Gemini AI timed out. Please try again."
        : "Gemini AI could not process this request. Please try again."
    }, error?.name === "AbortError" ? 504 : 500, request);
  }
}

async function handleChatFile(request, env) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  // Allow the supported 20 MB video upload plus base64/frame overhead, while rejecting oversized bodies.
  if (contentLength > 30 * 1024 * 1024) return jsonResponse({ error: "Upload is too large. Please choose a video smaller than 20 MB or a PDF smaller than 8 MB." }, 413, request);
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, request);
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const mimeType = String(body?.mimeType || "");
    const fileName = String(body?.fileName || "attachment").slice(0, 180);
    const language = normalizeLanguage(message, body?.language);

    // Videos: transcribe the original MP4/WEBM/MOV audio with Groq Whisper,
    // then combine its transcript with one compressed video frame for visual analysis.
    if (Array.isArray(body?.frames) && body.frames.length === 1 && env.GROQ_API_KEY) {
      const frames = body.frames.map((dataUrl) => {
        const value = String(dataUrl || "");
        const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
        if (!match) throw new Error("One of the image frames is invalid. Please select the file again.");
        return { mimeType: match[1].toLowerCase(), base64: match[2] };
      });
      const totalBase64 = frames.reduce((sum, frame) => sum + frame.base64.length, 0);
      if (totalBase64 > 10_500_000) return jsonResponse({ error: "The selected photo or video is too large after processing. Please choose a smaller file." }, 413, request);

      let transcript = "";
      let audioNote = "";
      if (body?.isVideo === true && typeof body?.videoDataUrl === "string") {
        const videoMatch = body.videoDataUrl.match(/^data:(video\/(?:mp4|webm|quicktime));base64,([A-Za-z0-9+/=]+)$/i);
        if (!videoMatch) return jsonResponse({ error: "The video audio could not be read. Please upload an MP4 or WEBM video." }, 400, request);
        if (videoMatch[2].length > 26_500_000) return jsonResponse({ error: "Please choose a video smaller than 20 MB so its audio can be transcribed." }, 413, request);
        try {
          const binary = atob(videoMatch[2]);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const audioForm = new FormData();
          audioForm.append("file", new Blob([bytes], { type: videoMatch[1].toLowerCase() }), fileName);
          audioForm.append("model", "whisper-large-v3-turbo");
          audioForm.append("response_format", "json");
          const audioResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": "Bearer " + env.GROQ_API_KEY },
            body: audioForm,
            signal: AbortSignal.timeout(45000)
          });
          const audioData = await audioResponse.json().catch(() => ({}));
          if (audioResponse.ok && typeof audioData?.text === "string") {
            transcript = audioData.text.trim().slice(0, 12000);
          } else {
            audioNote = "Audio transcription could not be completed (" + String(audioData?.error?.message || ("HTTP " + audioResponse.status)).slice(0, 120) + "). Analyze the visible frame and clearly tell the user the audio could not be understood.";
            console.error("Groq audio transcription error:", audioResponse.status, String(audioData?.error?.message || "").slice(0, 180));
          }
        } catch (audioError) {
          audioNote = "Audio transcription failed. Analyze the visible frame and clearly tell the user the audio could not be understood.";
          console.error("Groq audio transcription request failed:", String(audioError?.message || audioError).slice(0, 180));
        }
      }
      const visualPrompt = "Reply only in " + language + ". You are analyzing " + (body?.isVideo ? "one representative frame from a video" : "an image") + " named: " + fileName + ". Read visible text and report job title, company, location, salary, qualifications, experience, application instructions, dates, website and email if visible. Separate visible facts from uncertain or missing details. Never invent vacancies, salaries, employers or links. Give an official application link only when certain; otherwise say it must be verified. For video, combine the supplied audio transcript with the visible frame. If the transcript is empty or audio transcription failed, say so honestly; never pretend to have heard speech.";
      const userText = (message || "Please analyze this attachment and extract its important details.") +
        (transcript ? "\n\nVIDEO AUDIO TRANSCRIPT:\n" + transcript : "") +
        (audioNote ? "\n\n" + audioNote : "");
      const content = [
        { type: "text", text: userText + "\n\n" + visualPrompt }
      ];
      for (const frame of frames) {
        content.push({ type: "image_url", image_url: { url: "data:" + frame.mimeType + ";base64," + frame.base64 } });
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GROQ_API_KEY },
          body: JSON.stringify({
            model: "qwen/qwen3.8-27b",
            messages: ([{ role: "system", content: visualPrompt }, { role: "user", content: [{ type: "text", text: message || "Analyze this image and extract its important details." }, ...content.slice(1)] }] as any),
            max_completion_tokens: 600,
            temperature: 0.2
          }),
          signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error("Groq vision error:", response.status, String(data?.error?.message || "").slice(0, 220));
          const status = response.status === 429 ? 429 : (response.status >= 500 ? 502 : response.status);
          return jsonResponse({ error: response.status === 429 ? "Free AI usage limit reached for now. Please try again later." : "The free vision AI could not analyze this file. " + String(data?.error?.message || ("HTTP " + response.status)).slice(0, 160) }, status, request);
        }
        const reply = data?.choices?.[0]?.message?.content?.trim();
        if (!reply) return jsonResponse({ error: "No answer was returned for this file. Please try again." }, 502, request);
        return jsonResponse({ reply, language, fileName, provider: "groq-vision", model: "qwen/qwen3.8-27b", transcriptionModel: body?.isVideo === true ? "whisper-large-v3-turbo" : null, audioTranscribed: Boolean(transcript), analyzedFrames: frames.length, isVideo: body?.isVideo === true }, 200, request);
      } finally {
        clearTimeout(timer);
      }
    }

    // Keep the existing Gemini PDF route for customers who have that secret configured.
    if (mimeType === "application/pdf") {
      if (!env.GEMINI_API_KEY) return jsonResponse({ error: "PDF analysis is not available on the free vision setup yet. Please upload a photo or screenshot instead." }, 415, request);
      const dataUrl = String(body?.dataUrl || "");
      const match = dataUrl.match(/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return jsonResponse({ error: "The selected PDF could not be read. Please select it again." }, 400, request);
      if (match[1].length > 11_200_000) return jsonResponse({ error: "Please choose a PDF smaller than 8 MB." }, 413, request);
      const prompt = SYSTEM_PROMPT(language) + "\n\nThe user attached a PDF named: " + fileName + ". Inspect it carefully and answer the user's request. Do not claim to see details that are not present.";
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: prompt }] }, contents: [{ role: "user", parts: [{ text: message || "Please summarize this PDF." }, { inlineData: { mimeType: "application/pdf", data: match[1] } }] }], generationConfig: { maxOutputTokens: 700, temperature: 0.2 } }),
        signal: AbortSignal.timeout(45000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return jsonResponse({ error: "PDF analysis failed. " + String(data?.error?.message || ("HTTP " + response.status)).slice(0, 160) }, response.status, request);
      const reply = data?.candidates?.[0]?.content?.parts?.map(part => typeof part.text === "string" ? part.text : "").join("").trim();
      if (!reply) return jsonResponse({ error: "No text answer was returned for this PDF." }, 502, request);
      return jsonResponse({ reply, language, fileName, provider: "gemini" }, 200, request);
    }
    return jsonResponse({ error: "Please upload a JPG, PNG, WEBP image, MP4, WEBM, or MOV video. Video audio is transcribed when possible and combined with one representative visual frame." }, 415, request);
  } catch (error) {
    console.error("Attachment analysis error:", String(error?.message || error).slice(0, 200));
    return jsonResponse({ error: error?.name === "AbortError" ? "File analysis took too long. Please try again." : (error?.message || "Could not process the attachment. Please try again.") }, error?.name === "AbortError" ? 504 : 400, request);
  }
}


async function handleDuffelFlightSearch(request, env) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 32 * 1024) return jsonResponse({ error: "Flight search request is too large." }, 413, request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, request);
  if (!env.DUFFEL_ACCESS_TOKEN) {
    return jsonResponse({ error: "Flight search is not configured yet. Add the DUFFEL_ACCESS_TOKEN secret in Cloudflare." }, 503, request);
  }
  try {
    const body = await request.json();
    const origin = String(body?.origin || "").trim().toUpperCase();
    const destination = String(body?.destination || "").trim().toUpperCase();
    const departureDate = String(body?.departureDate || "").trim();
    const returnDate = body?.returnDate ? String(body.returnDate).trim() : "";
    const adults = Number(body?.adults || 1);
    const cabinMap = { "economy": "economy", "premium economy": "premium_economy", "business": "business", "first": "first" };
    const cabinClass = cabinMap[String(body?.cabinClass || "economy").trim().toLowerCase()];
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || origin === destination) {
      return jsonResponse({ error: "Please select two different valid airport codes." }, 400, request);
    }
    if (!validDate(departureDate) || (returnDate && !validDate(returnDate))) {
      return jsonResponse({ error: "Please provide valid travel dates in YYYY-MM-DD format." }, 400, request);
    }
    const today = new Date().toISOString().slice(0, 10);
    const maxDate = new Date();
    maxDate.setUTCMonth(maxDate.getUTCMonth() + 12);
    if (departureDate < today || departureDate > maxDate.toISOString().slice(0, 10) ||
        (returnDate && (returnDate < departureDate || returnDate > maxDate.toISOString().slice(0, 10)))) {
      return jsonResponse({ error: "Choose travel dates from today up to 12 months ahead; return date must be on or after departure." }, 400, request);
    }
    if (!Number.isInteger(adults) || adults < 1 || adults > 9 || !cabinClass) {
      return jsonResponse({ error: "Choose 1–9 adults and a valid cabin class." }, 400, request);
    }
    const slices = [{ origin, destination, departure_date: departureDate }];
    if (returnDate) slices.push({ origin: destination, destination: origin, departure_date: returnDate });
    const payload = { data: { slices, passengers: Array.from({ length: adults }, () => ({ type: "adult" })), cabin_class: cabinClass } };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let response;
    try {
      response = await fetch("https://api.duffel.com/air/offer_requests", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.DUFFEL_ACCESS_TOKEN,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Duffel-Version": "v2"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally { clearTimeout(timer); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Duffel flight search failed:", response.status);
      return jsonResponse({
        error: response.status === 401 ? "Duffel rejected the API token. Check that Cloudflare contains an activated Duffel LIVE access token." :
          response.status === 429 ? "Flight search is temporarily busy. Please try again shortly." :
          "Flight search provider could not complete the request. Please try again."
      }, response.status === 429 ? 429 : 502, request);
    }
    // Never expose test-mode offers as real fares. Duffel's offer request reports live_mode.
    const liveMode = result?.data?.live_mode === true;
    if (!liveMode) {
      return jsonResponse({
        error: "Duffel returned test-mode results. No sample prices are displayed. Add an activated LIVE Duffel access token to the DUFFEL_ACCESS_TOKEN secret in Cloudflare.",
        offers: [], count: 0, liveMode: false
      }, 409, request);
    }
    const rawOffers = result?.data?.offers || result?.data?.offer_request?.offers || [];
    // Defense in depth: exclude Duffel's explicit test airline and incomplete price records.
    const verifiedOffers = rawOffers.filter(offer =>
      offer?.id &&
      offer?.total_amount !== undefined && offer?.total_amount !== null &&
      offer?.total_currency &&
      String(offer?.owner?.name || "").toLowerCase() !== "duffel airways" &&
      offer?.owner?.iata_code !== "ZZ" &&
      !(offer?.slices || []).some(slice => (slice?.segments || []).some(segment =>
        segment?.marketing_carrier?.iata_code === "ZZ" || segment?.operating_carrier?.iata_code === "ZZ"
      ))
    );
    const offers = verifiedOffers.slice(0, 10).map(offer => ({
      id: offer.id,
      totalAmount: offer.total_amount || "",
      totalCurrency: offer.total_currency || "",
      expiresAt: offer.expires_at || "",
      owner: offer.owner?.name || "Airline",
      slices: (offer.slices || []).map(slice => ({
        origin: slice.origin?.iata_code || slice.segments?.[0]?.origin?.iata_code || "",
        destination: slice.destination?.iata_code || slice.segments?.[slice.segments.length - 1]?.destination?.iata_code || "",
        segments: (slice.segments || []).map(segment => ({
          airline: segment.operating_carrier?.name || segment.marketing_carrier?.name || "Airline",
          flightNumber: [segment.marketing_carrier?.iata_code, segment.marketing_carrier_flight_number].filter(Boolean).join(" "),
          departingAt: segment.departing_at || "",
          arrivingAt: segment.arriving_at || ""
        }))
      }))
    }));
    return jsonResponse({
      offers, count: offers.length, liveMode: true,
      message: offers.length ? "Prices and availability can change. Recheck the selected offer before any booking." :
        "No offers were returned for this search. Try different dates or airports."
    }, 200, request);
  } catch (error) {
    console.error("Duffel flight search error:", error?.name || "Error");
    return jsonResponse({ error: error?.name === "AbortError" ? "Flight search timed out. Please try again." :
      "Could not process the flight search. Check the dates and try again." }, error?.name === "AbortError" ? 504 : 400, request);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });

    if (url.pathname === "/api/health") {
      return jsonResponse({ ok: true, aiConfigured: Boolean(env.GEMINI_API_KEY || env.GROQ_API_KEY), aiProvider: env.GEMINI_API_KEY ? "gemini-with-groq-fallback" : (env.GROQ_API_KEY ? "groq" : "none"), groqFallbackConfigured: Boolean(env.GROQ_API_KEY), duffelConfigured: Boolean(env.DUFFEL_ACCESS_TOKEN) }, 200, request);
    }

    if (url.pathname === "/api/chat-file") return handleChatFile(request, env);
    if (url.pathname === "/api/knowledge/ingest") return handleKnowledgeIngest(request, env);
    if (url.pathname === "/api/chat") {
      return handleChat(request, env);
    }

    if (url.pathname === "/api/flights/search") {
      return handleDuffelFlightSearch(request, env);
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse({
      error: "Static assets binding is unavailable in this Worker preview.",
      apiHealth: "/api/health"
    }, 404, request);
  }
};
