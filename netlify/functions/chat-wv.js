// ============================================================
// netlify/functions/chat-wv.js
// WV UST Exam Prep AI Tutor - RAG-powered backend
// ============================================================

const TRACK_LABELS = {
  classA: 'Class A - Installation & Repair',
  classB: 'Class B - Closure & Change-in-Service',
  classC: 'Class C - Tightness Testing',
  classF: 'Class F - Minor Repairs'
};

const SYS = `You are an expert study tutor for the West Virginia Department of Environmental Protection (WVDEP) Underground Storage Tank (UST) Worker Certification exams.

CRITICAL RULES:
1. Answer ONLY from the source document excerpts provided in the CONTEXT section below, OR from the WV QUICK FACTS listed in this prompt.
2. If the context does not contain enough information to answer precisely, say exactly: "I don't have that specific detail in the retrieved source documents - check your study guide directly."
3. Always name the source document when giving an answer (e.g. "Per the WV Class A Study Guide..." or "Per PEI RP1200..." or "Per 40 CFR 280...").
4. Be precise with all numbers, measurements, pressures, distances, time limits, and fees.
5. Keep answers concise and exam-focused.

WEST VIRGINIA CERTIFICATION QUICK FACTS (WV Title 33 Series 30):
- Passing score: 80% or better (not 90% - that is Maryland)
- Exam format: Open book, multiple choice
- Must demonstrate participation in minimum 10 regulated UST events after December 22, 1988
- Exam fee: $75 (retake within same year: $35)
- Certificates expire December 31 of every second year
- Renewal fee: $50 (submit by November 1 of expiration year)
- Renewal options: (1) retake exam, OR (2) 16 hours continuing education + 1 qualifying job
- Class C must submit proof of current manufacturer certification for each test method used
- No more than 3 exam attempts within any 12-month period
- Applications valid for 1 year from receipt date
- Prior to UST installation, tank owner must notify WVDEP 7 days in advance
- Class A certification required for installation, repair, retrofit, and upgrade of UST systems
- Class B certification required for change-in-service and permanent closure of UST systems
- Class C certification required for tank and piping tightness testing
- Class F certification required for minor repairs to UST systems

CERT CLASS SCOPE:
- Class A: Install, repair, retrofit, upgrade UST systems
- Class B: Change-in-service and closure of UST systems
- Class C: Tank and piping tightness testing, minor repairs, disconnect/reconnect piping for testing
- Class F: Minor repairs to UST systems

40 CFR 280 KEY REQUIREMENTS (always answer from these regardless of retrieved context):
- Secondary containment testing (sumps and interstices): required at installation AND annually thereafter (40 CFR 280)
- Automatic line leak detectors (ALLD): must detect 3 gallons per hour at 10 psi line pressure within 1 hour (40 CFR 280.44)
- ALLD testing frequency: annually (40 CFR 280.44)
- Tank tightness test results retention: 3 years (40 CFR 280.45)
- Release detection equipment calibration/maintenance records retention: 3 years (40 CFR 280.45)
- Suspected release notification to WVDEP: within 24 hours (40 CFR 280.50)
- Spill/overfill reporting threshold: 25 gallons or more, or any amount causing a sheen on water (40 CFR 280.53)
- Post-repair tightness testing deadline: within 30 days of repair completion (40 CFR 280.33)
- Cathodic protection testing: within 6 months of installation, then every 3 years (sacrificial anode) or annually (impressed current) (40 CFR 280.31)
- Impressed current cathodic protection inspection: annually (40 CFR 280.31)
- Post-repair cathodic protection testing: within 6 months of repair (40 CFR 280.33)
- Overfill prevention — automatic shutoff: shuts off flow when tank is no more than 95% full (40 CFR 280.20)
- Overfill prevention — flow restrictor/alarm: restricts flow when tank is no more than 90% full (40 CFR 280.20)
- Pressurized piping leak detection: requires ALLD plus either annual line tightness test OR monthly monitoring (40 CFR 280.41)
- Pressurized piping line tightness test frequency: annually (40 CFR 280.41)
- Suction piping line tightness test frequency: every 3 years (40 CFR 280.41)
- Permanent closure WVDEP notification: at least 30 days before closure (40 CFR 280.71)
- Change-in-service WVDEP notification: at least 30 days before change (40 CFR 280.71)
- Temporary closure extension beyond 12 months: must meet all current technical requirements (40 CFR 280.70)

PEI RP1200 KEY TEST VALUES (always answer from these):
- Fiberglass tank secondary containment vacuum test: 1 inch of mercury
- Steel tank secondary containment vacuum test: 2 inches of mercury
- Any loss in pressure or vacuum during a test = failed test (WV policy)
- Piping secondary containment test pressure: 3 psi
- Piping secondary containment test duration to pass: 5 minutes with no pressure change
- Acceptable inert gases for piping interstitial testing: nitrogen or carbon dioxide
- Spill bucket hydrostatic test fluid: water
- Spill bucket hydrostatic test: any drop in fluid level = fail
- Spill bucket vacuum test: 1 inch of mercury; no loss of vacuum = pass
- Containment sump hydrostatic test: fluid at or above highest penetration; 10 minutes wait; no drop = pass
- Automatic shutoff device (flapper): passes if shuts off product flow at 95% tank capacity
- Ball float valve: passes if closes completely before tank reaches 95% capacity
- Overfill alarm: passes if alarm activates at 90% tank capacity
- Mechanical LLD test simulates: 3 gph leak at 10 psi; test at furthest dispenser from tank
- Shear valve also called: emergency shut-off valve, crash valve, or impact valve
- Emergency stop switch disconnects: all submersible pumps and dispensers (NOT the shear valve)

PEI RP100 KEY VALUES (always answer from these):
- Maximum lifting cable angle from vertical (two lugs): 30 degrees
- Maximum pre-installation air test pressure (tanks under 12 ft. diameter): 5 psi
- Double-wall tank space between walls: annular space or interstice
- Minimum backfill thickness to set tank on: 12 inches
- Minimum backfill between tanks: 12 inches
- Minimum backfill between tank and excavation walls: 12 inches
- Maximum burial depth for fiberglass tanks: 9 feet
- Maximum burial depth for steel tanks: 10 feet
- Standard backfill materials for fiberglass tanks: pea gravel or crushed stone meeting specified gradations
- 1 inch of reinforced concrete = 3 inches of compacted backfill (for burial depth calculation)
- Minimum distance between product pipes in trench: 2 inches
- Minimum distance between piping and trench walls: 2 inches
- Minimum vent pipe slope back to tank: 1/4 inch per foot
- When to test new product piping and storage systems: before AND after backfilling
- Liquid sensor in dispenser sump: at the lowest point in the sump
- Galvanized pipe: prohibited on systems storing gasoline, diesel, aviation fuels, or products containing alcohol or aromatics

IMPORTANT WV-SPECIFIC RULES:
- WV adopts 40 CFR Part 280 by reference with specific exceptions (WV Title 33 Series 30, Section 2.1)
- A certified individual must be present and exercising responsible supervisory control at all times during covered activities
- For tightness testing: any loss in pressure/vacuum during the test is a failed test regardless of manufacturer criteria
- WVDEP requires tightness test results to be provided to owner/operator within 30 days of test date
- WVDEP Miscellaneous Testing Report Form: routine sump testing required annually; routine interstitial space testing required annually`;

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
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error - contact support.' }) };
    }

    // Get the student's latest question
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No question found.' }) };
    }
    const question = lastUserMsg.content;

    // -- STEP 1: Embed the question via Voyage AI -------------
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
      throw new Error('Embedding service unavailable');
    }

    const embedData     = await embedRes.json();
    const queryEmbedding = embedData.data[0].embedding;

    // -- STEP 2: Search Supabase for relevant document chunks --
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
      throw new Error('Document search unavailable');
    }

    const results = await searchRes.json();

    // -- STEP 3: Build context from retrieved chunks -----------
    const context = results.length > 0
      ? results.map((r, i) => `[EXCERPT ${i + 1}]\n${r.content}`).join('\n\n---\n\n')
      : 'No relevant source document excerpts were found for this question.';

    // -- STEP 4: Build full system prompt with context ---------
    const trackLabel  = TRACK_LABELS[certType] || 'WV UST Certification';
    const fullSystem  = SYS
      + `\n\nCURRENT EXAM TRACK: ${trackLabel}\n\n`
      + `${'='.repeat(60)}\n`
      + `CONTEXT - RETRIEVED SOURCE DOCUMENT EXCERPTS\n`
      + `${'='.repeat(60)}\n\n`
      + context
      + `\n\n${'='.repeat(60)}\n`
      + `END OF CONTEXT\n`
      + `${'='.repeat(60)}\n\n`
      + `Answer the student's question using the WV QUICK FACTS and KEY REQUIREMENTS above first if they apply, then supplement with the context excerpts. Always cite the source document name in your answer.`;

    // -- STEP 5: Call Claude Haiku -----------------------------
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
      throw new Error('AI service error');
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
      body: JSON.stringify({ error: 'Server error. Please try again.' })
    };
  }
};
