// ============================================================
// netlify/functions/chat-wv.js
// WV UST Exam Prep AI Tutor — RAG-powered backend
// ============================================================

const TRACK_LABELS = {
  classA: 'Class A — Installation & Repair',
  classB: 'Class B — Closure & Change-in-Service',
  classC: 'Class C — Tightness Testing',
  classF: 'Class F — Minor Repairs'
};

const SYS = `You are an expert study tutor for the West Virginia Department of Environmental Protection (WVDEP) Underground Storage Tank (UST) Worker Certification exams.

CRITICAL RULES:
1. Answer ONLY from the source document excerpts provided in the CONTEXT section below.
2. If the context does not contain enough information to answer precisely, say exactly: "I don't have that specific detail in the retrieved source documents — check your study guide directly."
3. Always name the source document when giving an answer (e.g. "Per the WV Class A Study Guide..." or "Per PEI RP1200-19...").
4. Be precise with all numbers, measurements, pressures, distances, time limits, and fees.
5. Keep answers concise and exam-focused.

WEST VIRGINIA CERTIFICATION QUICK FACTS (WV Title 33 Series 30):
- Passing score: 80% or better (not 90% — that is Maryland)
- Exam format: Open book, multiple choice
- Must demonstrate participation in minimum 10 regulated UST events after December 22, 1988
- Exam fee: $75 (retake within same year: $35)
- Certificates expire December 31 of every second year
- Renewal fee: $50 (submit by November 1 of expiration year)
- Renewal options: (1) retake exam, OR (2) 16 hours continuing education + 1 qualifying job
- Class C must submit proof of current manufacturer certification for each test method used
- No more than 3 exam attempts within any 12-month period
- Applications valid for 1 year from receipt date

CERT CLASS SCOPE:
- Class A: Install, repair, retrofit, upgrade UST systems
- Class B: Change-in-service and closure of UST systems
- Class C: Tank and piping tightness testing, minor repairs, disconnect/reconnect piping for testing
- Class F: Minor repairs to UST systems

IMPORTANT WV-SPECIFIC RULES:
- WV adopts 40 CFR Part 280 by reference with specific exceptions (WV Title 33 Series 30, Section 2.1)
- A certified individual must be present and exercising responsible supervisory control at all times during covered activities
- For tightness testing: any loss in pressure/vacuum during the test is a failed test regardless of manufacturer criteria
- WVDEP requires tightness test results to be provided to owner/operator
- Testing report must be submitted to facility within 30 days of test date`;

exports.handler = async function(event, context) {

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { messages, certType } = JSON.parse(event.body);

    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    // Pull credentials from Netlify environment
    const anthropicKey  = process.env.mdetutor_anthropic_API_1;
    const voyageKey     = process.env.VOYAGE_API_KEY;
    const supabaseUrl   = process.env.SUPABASE_URL;
    const supabaseKey   = process.env.SUPABASE_SERVICE_KEY;

    if (!anthropicKey || !voyageKey || !supabaseUrl || !supabaseKey) {
      console.error('Missing env vars:', {
        anthropic: !!anthropicKey,
        voyage:    !!voyageKey,
        supabase:  !!supabaseUrl,
        sbKey:     !!supabaseKey
      });
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error — contact support.' }) };
    }

    // Get the student's latest question
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No question found.' }) };
    }
    const question = lastUserMsg.content;

    // ── STEP 1: Embed the question via Voyage AI ─────────────
    const embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${voyageKey}`
      },
      body: JSON.stringify({ input: [question], model: 'voyage-2' })
    });

    if (!embedRes.ok) {
      const err = await embedRes.text();
      console.error('Voyage AI error:', err);
      return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Voyage AI error: ' + err }) };
    }

    const embedData     = await embedRes.json();
    const queryEmbedding = embedData.data[0].embedding;

    // ── STEP 2: Search Supabase for relevant document chunks ──
    const searchRes = await fetch(`${supabaseUrl}/rest/v1/rpc/match_wv_documents`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        query_embedding: queryEmbedding,
        match_count:     6
      })
    });

    if (!searchRes.ok) {
      const err = await searchRes.text();
      console.error('Supabase search error:', err);
      return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Supabase error: ' + err }) };
    }

    const results = await searchRes.json();

    // ── STEP 3: Build context from retrieved chunks ───────────
    const context = results.length > 0
      ? results.map((r, i) => `[EXCERPT ${i + 1}]\n${r.content}`).join('\n\n---\n\n')
      : 'No relevant source document excerpts were found for this question.';

    // ── STEP 4: Build full system prompt with context ─────────
    const trackLabel  = TRACK_LABELS[certType] || 'WV UST Certification';
    const fullSystem  = SYS
      + `\n\nCURRENT EXAM TRACK: ${trackLabel}\n\n`
      + `${'═'.repeat(60)}\n`
      + `CONTEXT — RETRIEVED SOURCE DOCUMENT EXCERPTS\n`
      + `${'═'.repeat(60)}\n\n`
      + context
      + `\n\n${'═'.repeat(60)}\n`
      + `END OF CONTEXT\n`
      + `${'═'.repeat(60)}\n\n`
      + `Answer the student's question using ONLY the context above. Cite the source document name in your answer.`;

    // ── STEP 5: Call Claude Haiku ─────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':       'application/json',
        'x-api-key':          anthropicKey,
        'anthropic-version':  '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system:     fullSystem,
        messages:   messages.slice(-8)
      })
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error('Claude API error:', err);
      return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Claude API error: ' + err }) };
    }

    const claudeData = await claudeRes.json();
    const reply      = claudeData.content?.[0]?.text || 'No response received.';

    return {
      statusCode: 200,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ content: reply })
    };

  } catch (err) {
    console.error('Function error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Debug: ' + err.message })
    };
  }
};
