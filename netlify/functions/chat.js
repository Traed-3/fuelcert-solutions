// netlify/functions/chat.js
// MDE UST Exam Prep AI Tutor - RAG-powered backend

const CERT_LABELS = {
  technician: 'UST Technician',
  remover:    'UST Remover',
  inspector:  'UST Inspector',
  heating:    'Heating Oil Technician'
};

const SYS = `You are an expert study tutor for the Maryland Department of the Environment (MDE) Underground Storage Tank (UST) certification exams.

CRITICAL RULES:
1. Answer ONLY from the source document excerpts provided in the CONTEXT section below.
2. If the context does not contain enough information to answer precisely, say exactly: "I don't have that specific detail in the retrieved source documents - check your study guide directly."
3. Always name the source document when giving an answer (e.g. "Per COMAR 26.10..." or "Per PEI RP1200-19...").
4. Be precise with all numbers, measurements, pressures, distances, time limits, and fees.
5. Keep answers concise and exam-focused.

MDE QUICK FACTS:
- Passing score: 90% or better
- Certifications expire 2 years from issue date
- Testing: second Tuesday of each month, MDE main office, 1:00 PM
- Register: call one week in advance 410-537-3442
- Application due 30 days before test registration`;

exports.handler = async function(event, context) {

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

    const anthropicKey = process.env.mdetutor_anthropic_API_1;
    const voyageKey    = process.env.VOYAGE_API_KEY;
    const supabaseUrl  = process.env.SUPABASE_URL;
    const supabaseKey  = process.env.SUPABASE_SERVICE_KEY;

    if (!anthropicKey || !voyageKey || !supabaseUrl || !supabaseKey) {
      console.error('Missing env vars');
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }

    const lastUserMsg = [...messages].reverse().find(function(m) { return m.role === 'user'; });
    if (!lastUserMsg) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No question found.' }) };
    }
    const question = lastUserMsg.content;

    // STEP 1: Embed via Voyage AI
    var embedRes;
    try {
      embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + voyageKey },
        body: JSON.stringify({ input: [question], model: 'voyage-2' })
      });
      if (!embedRes.ok) {
        var errText = await embedRes.text();
        throw new Error('Voyage HTTP ' + embedRes.status + ': ' + errText);
      }
    } catch(e) {
      console.error('STEP1 Voyage error:', e.message);
      throw new Error('STEP1 Voyage: ' + e.message);
    }

    var embedJson = await embedRes.json();
    var queryEmbedding = embedJson.data[0].embedding;

    // STEP 2: Search Supabase
    var baseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
    var searchRes;
    try {
      searchRes = await fetch(baseUrl + '/rest/v1/rpc/match_mde_documents', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey
        },
        body: JSON.stringify({ query_embedding: queryEmbedding, match_count: 6 })
      });
      if (!searchRes.ok) {
        var errText2 = await searchRes.text();
        throw new Error('Supabase HTTP ' + searchRes.status + ': ' + errText2);
      }
    } catch(e) {
      console.error('STEP2 Supabase error:', e.message);
      throw new Error('STEP2 Supabase: ' + e.message);
    }

    var results = await searchRes.json();

    // STEP 3: Build context
    var contextText = results.length > 0
      ? results.map(function(r, i) { return '[EXCERPT ' + (i+1) + ']\n' + r.content; }).join('\n\n---\n\n')
      : 'No relevant source document excerpts were found for this question.';

    // STEP 4: Build system prompt
    var certLabel = CERT_LABELS[certType] || 'MDE UST Certification';
    var divider = '============================================================';
    var fullSystem = SYS
      + '\n\nCURRENT EXAM TRACK: ' + certLabel + '\n\n'
      + divider + '\n'
      + 'CONTEXT - RETRIEVED SOURCE DOCUMENT EXCERPTS\n'
      + divider + '\n\n'
      + contextText
      + '\n\n' + divider + '\n'
      + 'END OF CONTEXT\n'
      + divider + '\n\n'
      + "Answer the student's question using ONLY the context above. Cite the source document name in your answer.";

    // STEP 5: Call Claude
    var claudeRes;
    try {
      claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system:     fullSystem,
          messages:   messages.slice(-8)
        })
      });
      if (!claudeRes.ok) {
        var errText3 = await claudeRes.text();
        throw new Error('Claude HTTP ' + claudeRes.status + ': ' + errText3);
      }
    } catch(e) {
      console.error('STEP5 Claude error:', e.message);
      throw new Error('STEP5 Claude: ' + e.message);
    }

    var claudeJson = await claudeRes.json();
    var reply = (claudeJson.content && claudeJson.content[0] && claudeJson.content[0].text) || 'No response received.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
