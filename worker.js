// Cloudflare Worker for handling backend API calls (reports, suggestions, trending)
// NOTE: This is deployed separately to Cloudflare Workers.

const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function getCorsHeaders(request, env) {
  const allowedOrigins = ['https://osintdeck.org', 'http://localhost:5173'];
  const requestOrigin = request?.headers?.get('Origin');
  
  let allowedOrigin = 'https://osintdeck.org';
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    allowedOrigin = requestOrigin;
  } else if (env.ALLOWED_ORIGIN && allowedOrigins.includes(env.ALLOWED_ORIGIN)) {
    allowedOrigin = env.ALLOWED_ORIGIN;
  }
  
  return {
    ...BASE_CORS_HEADERS,
    'Access-Control-Allow-Origin': allowedOrigin
  };
}

function jsonResponse(body, status, extraHeaders = {}, env, request = null) {
  const headers = {
    ...getCorsHeaders(request, env),
    ...SECURITY_HEADERS,
    ...extraHeaders,
    'Content-Type': 'application/json',
  };
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(message, status, env, extraHeaders = {}, request = null) {
  console.error(`Worker Error Response (${status}): ${message}`);
  return jsonResponse({ error: message }, status, extraHeaders, env, request);
}

function sanitizeString(input, maxLength) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed.substring(0, maxLength) : null;
}

function isValidHttpUrl(urlString) {
  if (!urlString) return false;
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

async function checkRateLimit(request, env, ctx, keyPrefix) {
  if (!env?.RATE_LIMIT_KV) {
    console.warn('RATE_LIMIT_KV not bound. Skipping rate limiting.');
    return { allow: true };
  }

  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) {
    console.warn('CF-Connecting-IP header not found. Skipping rate limiting.');
    return { allow: true };
  }

  const MAX_REQUESTS = parseInt(env.RATE_LIMIT_MAX_REQUESTS) || 10;
  const WINDOW_MS = parseInt(env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000;

  const kvKey = `rate-limit-${keyPrefix}-${ip}`;
  const now = Date.now();
  let record;

  try {
    record = await env.RATE_LIMIT_KV.get(kvKey, { type: 'json' });
  } catch (e) {
    console.error('Rate limit KV GET error:', e);
    return { allow: true };
  }

  if (record && now - record.timestamp < WINDOW_MS) {
    if (record.count >= MAX_REQUESTS) {
      const retryAfter = Math.ceil((record.timestamp + WINDOW_MS - now) / 1000);
      return { allow: false, retryAfter: retryAfter };
    }
    record.count++;
  } else {
    record = { count: 1, timestamp: now };
  }

  try {
    ctx.waitUntil(
      env.RATE_LIMIT_KV.put(kvKey, JSON.stringify(record), {
        expirationTtl: Math.ceil(WINDOW_MS / 1000) + 60,
      })
    );
  } catch (e) {
    console.error('Rate limit KV PUT error:', e);
  }

  return { allow: true };
}

async function handleReportPost(request, env, ctx) {
  if (!env?.REPORTS_KV) {
    return errorResponse('Storage unavailable: REPORTS_KV not bound.', 500, env, {}, request);
  }

  const rateLimitResult = await checkRateLimit(request, env, ctx, 'report');
  if (!rateLimitResult.allow) {
    return errorResponse(
      'Too many requests. Please try again later.',
      429,
      env,
      { 'Retry-After': rateLimitResult.retryAfter.toString() },
      request
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse('Invalid JSON body.', 400, env, {}, request);
  }

  if (typeof body !== 'object' || body === null) {
    return errorResponse('Invalid request body type.', 400, env, {}, request);
  }

  const itemName = sanitizeString(body.reportedItemName, 200);
  const itemUrl = sanitizeString(body.reportedItemUrl, 1024);
  const itemPath = sanitizeString(body.reportedItemPath, 500);
  const context = sanitizeString(body.reportContext, 500);

  if (!itemName) {
    return errorResponse("Missing or invalid 'reportedItemName'.", 400, env, {}, request);
  }
  if (itemUrl && !isValidHttpUrl(itemUrl)) {
    return errorResponse("Invalid format for 'reportedItemUrl'.", 400, env, {}, request);
  }

  const reportData = {
    name: itemName,
    url: itemUrl,
    path: itemPath,
    context: context,
    timestamp: new Date().toISOString(),
    status: 'new',
    reporterInfo: {
      ip: request.headers.get('CF-Connecting-IP'),
      country: request.headers.get('CF-IPCountry'),
      userAgent: sanitizeString(request.headers.get('User-Agent'), 200),
    },
  };

  const uniqueId = `report-${crypto.randomUUID()}`;

  try {
    await env.REPORTS_KV.put(uniqueId, JSON.stringify(reportData));
    return jsonResponse({ success: true, id: uniqueId }, 200, {}, env, request);
  } catch (kvError) {
    console.error('KV Write Error (Report):', kvError);
    return errorResponse('Failed to store report data.', 500, env, {}, request);
  }
}

async function handleSuggestPost(request, env, ctx) {
  if (!env?.SUGGESTIONS_KV) {
    return errorResponse('Storage unavailable: SUGGESTIONS_KV not bound.', 500, env, {}, request);
  }

  const rateLimitResult = await checkRateLimit(request, env, ctx, 'suggest');
  if (!rateLimitResult.allow) {
    return errorResponse(
      'Too many requests. Please try again later.',
      429,
      env,
      { 'Retry-After': rateLimitResult.retryAfter.toString() },
      request
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse('Invalid JSON body.', 400, env, {}, request);
  }

  if (typeof body !== 'object' || body === null) {
    return errorResponse('Invalid request body type.', 400, env, {}, request);
  }

  const name = sanitizeString(body.name, 100);
  const url = sanitizeString(body.url, 1024);
  const description = sanitizeString(body.description, 500);
  const tagsInput = body.tags;

  if (!name) {
    return errorResponse("Missing or invalid 'name'.", 400, env, {}, request);
  }
  if (!url || !isValidHttpUrl(url)) {
    return errorResponse(
      "Missing or invalid 'url'. Must be a valid HTTP/S URL.",
      400,
      env,
      {},
      request
    );
  }

  let tags = [];
  if (Array.isArray(tagsInput)) {
    tags = tagsInput
      .map((tag) => sanitizeString(tag, 50))
      .filter((tag) => tag !== null)
      .slice(0, 10);
  }

  const suggestionData = {
    name: name,
    url: url,
    description: description,
    tags: tags,
    timestamp: new Date().toISOString(),
    status: 'pending',
    reporterInfo: {
      ip: request.headers.get('CF-Connecting-IP'),
      country: request.headers.get('CF-IPCountry'),
      userAgent: sanitizeString(request.headers.get('User-Agent'), 200),
    },
  };

  const uniqueId = `suggestion-${crypto.randomUUID()}`;

  try {
    await env.SUGGESTIONS_KV.put(uniqueId, JSON.stringify(suggestionData));
    return jsonResponse({ success: true, id: uniqueId }, 200, {}, env, request);
  } catch (kvError) {
    console.error('KV Write Error (Suggestion):', kvError);
    return errorResponse('Failed to store suggestion data.', 500, env, {}, request);
  }
}

const CLICK_DEDUP_TTL = 3600;
const TRENDING_WINDOW = 604800;

async function recordResourceClick(request, env, ctx) {
  if (!env?.TRENDING_KV) {
    return errorResponse('Storage unavailable: TRENDING_KV not bound.', 500, env, {}, request);
  }

  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const resourceId = request.searchParams.get('resourceId');
  const resourceName = request.searchParams.get('resourceName');
  const resourceUrl = request.searchParams.get('resourceUrl');

  if (!resourceId || !resourceName || !resourceUrl) {
    return errorResponse('Missing required parameters.', 400, env, {}, request);
  }

  try {
    const dedupKey = `click:${resourceId}:${clientIP}`;
    const recentClick = await env.TRENDING_KV.get(dedupKey);
    if (recentClick) {
      return jsonResponse({ success: true, cached: true }, 200, {}, env, request);
    }

    const now = Date.now();
    const clickKey = `trending:${resourceId}:${now}`;
    const clickData = {
      resourceId,
      resourceName,
      resourceUrl,
      timestamp: now
    };

    await Promise.all([
      env.TRENDING_KV.put(dedupKey, '1', { expirationTtl: CLICK_DEDUP_TTL }),
      env.TRENDING_KV.put(clickKey, JSON.stringify(clickData), { expirationTtl: TRENDING_WINDOW })
    ]);

    return jsonResponse({ success: true }, 200, {}, env, request);
  } catch (error) {
    console.error('Error recording click:', error);
    return errorResponse('Failed to record click.', 500, env, {}, request);
  }
}

async function getTrendingResources(env) {
  const cacheKey = 'trending-resources-cache';
  const CACHE_TTL = 300;

  let cachedData;
  try {
    cachedData = await env.TRENDING_CACHE.get(cacheKey, { type: 'json' });
    if (cachedData) {
      return cachedData;
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }

  const now = Date.now();
  const windowStart = now - (24 * 60 * 60 * 1000);
  let clicks;
  
  try {
    clicks = await env.CLICKS_KV.list({ prefix: 'click-' });
  } catch (e) {
    console.error('KV List Error (Clicks):', e);
    return [];
  }

  const clickCounts = new Map();
  
  for (const key of clicks.keys) {
    try {
      const click = await env.CLICKS_KV.get(key.name, { type: 'json' });
      if (click && click.timestamp > windowStart) {
        const resourceId = click.resourceId;
        clickCounts.set(resourceId, (clickCounts.get(resourceId) || 0) + 1);
      }
    } catch (e) {
      console.error('KV Get Error (Click):', e);
    }
  }

  const trending = Array.from(clickCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, count }));

  try {
    await env.TRENDING_CACHE.put(cacheKey, JSON.stringify(trending), { expirationTtl: CACHE_TTL });
  } catch (e) {
    console.warn('Cache write error:', e);
  }

  return trending;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: getCorsHeaders(request, env)
      });
    }

    try {
      if (request.method === 'GET' && url.pathname === '/trending') {
        const trending = await getTrendingResources(env);
        return jsonResponse(trending, 200, {}, env, request);
      }
      
      if (request.method === 'POST') {
        switch (url.pathname) {
          case '/report':
            return handleReportPost(request, env, ctx);
          case '/suggest':
            return handleSuggestPost(request, env, ctx);
          case '/click':
            return recordResourceClick(request, env, ctx);
          default:
            return errorResponse('Endpoint Not Found', 404, env, {}, request);
        }
      }
      
      return errorResponse('Method Not Allowed', 405, env, {}, request);
    } catch (e) {
      console.error('Unhandled Worker Error:', e);
      return errorResponse('An unexpected error occurred.', 500, env, {}, request);
    }
  },
};