const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const redis = require('redis');
const rateLimit = require('express-rate-limit');

/** Deterministic positive affirmation when OpenRouter is unavailable or misconfigured. */
function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
    return Math.abs(h);
}

const LOCAL_AFFIRMATIONS = [
    'Your awareness today is already a brave step toward peace.',
    'You deserve gentleness—even on days that feel heavy.',
    'Small honest reflections add up to real growth over time.',
    'Noticing how you feel is strength, not weakness.',
    'You are allowed to rest and still be making progress.',
    'What you feel is valid; you are not alone in this.',
    'One moment of self-kindness can shift the whole day.',
    'Your patience with yourself is a quiet form of courage.',
    'Healing is not linear; showing up today still counts.',
    'You can hold both struggle and hope at the same time.',
];

function localAffirmationFromJournal(text) {
    const trimmed = (text || '').trim();
    const pick = simpleHash(trimmed.slice(0, 200)) % LOCAL_AFFIRMATIONS.length;
    let out = LOCAL_AFFIRMATIONS[pick];
    if (trimmed.length >= 10) {
        const snippet = trimmed.replace(/\s+/g, ' ').slice(0, 48);
        out = `${out} (${snippet}${trimmed.length > 48 ? '…' : ''})`;
    }
    return out.slice(0, 200);
}

function stringifyOpenRouterError(errorData) {
    if (errorData == null) return '';
    if (typeof errorData === 'string') return errorData;
    if (errorData.error) {
        const e = errorData.error;
        if (typeof e === 'string') return e;
        if (e && typeof e.message === 'string') return e.message;
        try {
            return JSON.stringify(e);
        } catch {
            return String(e);
        }
    }
    if (errorData.message) return String(errorData.message);
    try {
        return JSON.stringify(errorData);
    } catch {
        return String(errorData);
    }
}

let supabaseClient = null;

/** Server-side only — never expose the service role key to browsers. */
function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    if (!supabaseClient) {
        supabaseClient = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return supabaseClient;
}

let dbReachable = false;

function entryRowToClient(row) {
    if (!row) return null;
    return {
        _id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
        date: row.date,
        moodValue: row.mood_value,
        moodLabel: row.mood_label,
        text: row.text,
        affirmation: row.affirmation,
        createdAt: row.created_at,
    };
}

function userRowToClient(row) {
    if (!row) return null;
    return {
        _id: row.id,
        clerkId: row.clerk_id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        imageUrl: row.image_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function probeSupabase() {
    const sb = getSupabase();
    if (!sb) {
        dbReachable = false;
        return;
    }
    const { error } = await sb.from('user_profiles').select('id').limit(1);
    dbReachable = !error;
    if (error) {
        console.warn('[Supabase] Connection check failed:', error.message);
    }
}

function supabaseConfigured() {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

if (!supabaseConfigured()) {
    console.warn('[Supabase] Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see supabase/schema.sql).');
} else {
    probeSupabase()
        .then(() => {
            if (dbReachable) console.log('Supabase connected...');
        })
        .catch((e) => console.warn('[Supabase]', e.message || String(e)));
    setInterval(() => probeSupabase().catch(() => {}), 15000).unref?.();
}

// Redis client setup with graceful no-op fallback when Redis is unavailable
let redisClient;

function createNoopRedis() {
    return {
        isOpen: false,
        get: async () => null,
        setEx: async () => {},
        del: async () => {},
        quit: async () => {},
    };
}

const useRedis = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST || process.env.REDIS_PORT);
if (useRedis) {
    try {
        const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
        redisClient = redis.createClient({
            url,
            legacyMode: true,
        });

        redisClient.on('error', (err) => {
            console.warn('[Redis] Connection error:', err && err.message ? err.message : String(err));
        });

        redisClient.on('connect', () => {
            console.log('[Redis] Connected to Redis server');
        });

        // Connect Redis (non-blocking). If it fails, swap in noop client.
        redisClient.connect().catch(err => {
            console.warn('[Redis] Could not connect, continuing without cache:', err && err.message ? err.message : String(err));
            redisClient = createNoopRedis();
        });
    } catch (e) {
        console.warn('[Redis] Init error, continuing without cache:', e && e.message ? e.message : String(e));
        redisClient = createNoopRedis();
    }
} else {
    // No Redis settings provided — use noop cache to avoid connection errors
    redisClient = createNoopRedis();
}

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.use(cors());
app.use(express.json());
// Redirect root to login page (must be before static middleware)
app.get('/', (req, res) => {
    return res.redirect('/login.html');
});
// Serve frontend static files from the sibling `frontend` directory
const staticDir = path.join(__dirname, '..', 'Frontend');
app.use(express.static(staticDir));

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled Rejection:', reason);
});

// Rate limiting middleware
const affirmationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: 'Too many affirmation requests. Please try again in a minute.',
    standardHeaders: true,
    legacyHeaders: false,
});

const entriesLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many entry requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Generate affirmation endpoint with caching and rate limiting
app.post('/generate-affirmation', affirmationLimiter, async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: "No text provided for affirmation generation." });
    }

    const cacheKey = `affirmation:${Buffer.from(text.substring(0, 200)).toString('base64')}`;

    try {
        const cachedAffirmation = await redisClient.get(cacheKey);
        if (cachedAffirmation) {
            console.log(`[Redis] Cache hit for affirmation`);
            return res.json({ affirmation: cachedAffirmation, cached: true, source: 'cache' });
        }
    } catch (err) {
        console.warn('[Redis] Cache lookup error:', err.message);
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    let affirmation = null;
    let provider = null;
    let lastError = null;

    // OpenRouter when API key is set
    if (!affirmation && OPENROUTER_API_KEY) {
        try {
            console.log('[OpenRouter] Generating affirmation...');
            const prompt = `Generate a concise, positive affirmation (one or two sentences) based on this journal entry. Keep it under 150 characters and make it deeply personal and meaningful. Journal entry: "${text.substring(0, 300)}"`;

            const orResponse = await fetch(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a compassionate mental wellness advisor. Generate personalized affirmations for journal entries that are meaningful, uplifting, and directly related to the user\'s reflections.'
                            },
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        temperature: 0.8,
                        max_tokens: 120
                    })
                }
            );

            console.log(`[OpenRouter] Response status: ${orResponse.status}`);

            if (orResponse.ok) {
                const orData = await orResponse.json();
                if (orData.choices && orData.choices.length > 0) {
                    const message = orData.choices[0].message;
                    if (message && message.content) {
                        affirmation = message.content.trim();
                        provider = 'openrouter';
                        console.log('[OpenRouter] Successfully generated affirmation');
                    }
                }
            } else {
                const raw = await orResponse.text().catch(() => '');
                let errorData = {};
                try {
                    errorData = raw ? JSON.parse(raw) : {};
                } catch {
                    errorData = { message: raw || 'Unknown error' };
                }
                lastError = `OpenRouter ${orResponse.status}: ${stringifyOpenRouterError(errorData) || raw || 'Unknown error'}`;
                console.log('[OpenRouter] API error:', lastError);
            }
        } catch (error) {
            lastError = `OpenRouter fetch error: ${error.message}`;
            console.log('[OpenRouter] Fetch error:', error.message);
        }
    }

    if (!affirmation) {
        affirmation = localAffirmationFromJournal(text);
        provider = 'local';
        if (lastError) {
            console.log('[Affirmation] Using local fallback. OpenRouter issue:', lastError);
        } else if (!OPENROUTER_API_KEY) {
            console.log('[Affirmation] No OPENROUTER_API_KEY; using local affirmation.');
        }
    }

    try {
        await redisClient.setEx(cacheKey, 24 * 60 * 60, affirmation);
        console.log(`[Redis] Cached affirmation`);
    } catch (err) {
        console.warn('[Redis] Cache write error:', err.message);
    }

    res.json({ affirmation: affirmation, cached: false, source: provider });
});

// Health endpoint
app.get('/health', async (req, res) => {
    await probeSupabase().catch(() => {});
    const redisConnected = redisClient.isOpen;
    const connected = Boolean(getSupabase() && dbReachable);
    res.json({
        status: 'ok',
        db: 'supabase',
        dbState: connected ? 1 : 0,
        connected,
        redisConnected,
    });
});

// --- Social OAuth scaffolding (redirects) ---
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Google: redirect to Google OAuth consent page if client id configured
app.get('/auth/google', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${BASE_URL}/auth/google/callback`;
    if (!clientId) return res.status(501).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env' });
    const scope = encodeURIComponent('openid email profile');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    return res.redirect(url);
});

app.get('/auth/google/callback', (req, res) => {
    // Placeholder callback - exchange `code` server-side with Google's token endpoint
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code.');
    res.send('Google callback received. Implement server-side code exchange using GOOGLE_CLIENT_SECRET.');
});

// Facebook: redirect to Facebook OAuth if configured
app.get('/auth/facebook', (req, res) => {
    const clientId = process.env.FACEBOOK_APP_ID;
    const redirectUri = `${BASE_URL}/auth/facebook/callback`;
    if (!clientId) return res.status(501).json({ error: 'Facebook OAuth not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env' });
    const scope = encodeURIComponent('email,public_profile');
    const url = `https://www.facebook.com/v13.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=state&response_type=code&scope=${scope}`;
    return res.redirect(url);
});

app.get('/auth/facebook/callback', (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code.');
    res.send('Facebook callback received. Implement server-side code exchange using FACEBOOK_APP_SECRET.');
});

// X (Twitter) - placeholder
app.get('/auth/x', (req, res) => {
    // Twitter/X OAuth2 requires PKCE and app configuration. Provide guidance if not configured.
    return res.status(501).json({ error: 'X/Twitter OAuth not configured on server. See README to configure OAuth 2.0 with PKCE.' });
});

// Entry routes with caching and rate limiting
app.post('/entries', entriesLimiter, async (req, res) => {
    try {
        await probeSupabase().catch(() => {});
        const sb = getSupabase();
        if (!sb || !dbReachable) {
            return res.status(503).json({
                message: 'Database unavailable. Entries cannot be saved until Supabase is connected and tables exist.',
            });
        }

        const { date, moodValue, moodLabel, text } = req.body;
        if (date == null || String(date).trim() === '') {
            return res.status(400).json({ message: 'date is required.' });
        }
        if (moodLabel == null || String(moodLabel).trim() === '') {
            return res.status(400).json({ message: 'moodLabel is required.' });
        }
        if (text == null || String(text).trim() === '') {
            return res.status(400).json({ message: 'text is required.' });
        }
        const mv = Number(moodValue);
        if (!Number.isFinite(mv)) {
            return res.status(400).json({ message: 'moodValue must be a number.' });
        }

        console.log(`[entries] Received save request at ${new Date().toISOString()}`);
        console.log('[entries] Payload keys:', Object.keys(req.body));

        const row = {
            user_id: req.body.userId ?? null,
            user_email: req.body.userEmail ?? null,
            date: String(date),
            mood_value: mv,
            mood_label: String(moodLabel),
            text: String(text),
            affirmation: req.body.affirmation != null ? String(req.body.affirmation) : null,
        };

        const { data, error } = await sb.from('journal_entries').insert(row).select().single();
        if (error) throw error;

        console.log(`[entries] Saved entry id=${data.id}`);

        try {
            await redisClient.del('entries:all');
            if (req.body.userId) {
                await redisClient.del(`entries:user:${req.body.userId}`);
            }
            console.log('[Redis] Cleared entries cache');
        } catch (err) {
            console.warn('[Redis] Cache invalidation error:', err.message);
        }

        res.status(201).json(entryRowToClient(data));
    } catch (error) {
        console.error('Error saving entry:', error && error.stack ? error.stack : error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
});

app.get('/entries', entriesLimiter, async (req, res) => {
    const { userId, isAdmin } = req.query;

    const cacheKey = (isAdmin === 'true') ? 'entries:all' : `entries:user:${userId}`;

    try {
        const cachedEntries = await redisClient.get(cacheKey);
        if (cachedEntries) {
            console.log(`[Redis] Cache hit for ${cacheKey}`);
            return res.json(JSON.parse(cachedEntries));
        }
    } catch (err) {
        console.warn('[Redis] Cache lookup error:', err.message);
    }

    try {
        await probeSupabase().catch(() => {});
        const sb = getSupabase();
        if (!sb || !dbReachable) {
            return res.json([]);
        }

        let q = sb.from('journal_entries').select('*').order('created_at', { ascending: false });
        if (isAdmin !== 'true') {
            if (!userId) return res.json([]);
            q = q.eq('user_id', userId);
        }

        const { data: rows, error } = await q;
        if (error) throw error;

        const entries = (rows || []).map(entryRowToClient);

        try {
            await redisClient.setEx(cacheKey, 5 * 60, JSON.stringify(entries));
            console.log(`[Redis] Cached entries for ${cacheKey}`);
        } catch (err) {
            console.warn('[Redis] Cache write error:', err.message);
        }

        res.json(entries);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/entries/:id', entriesLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        await probeSupabase().catch(() => {});
        const sb = getSupabase();
        if (!sb || !dbReachable) {
            return res.status(503).json({ message: 'Database unavailable.' });
        }

        const { data: deletedRows, error } = await sb.from('journal_entries').delete().eq('id', id).select('id');
        if (error) throw error;
        if (!deletedRows || deletedRows.length === 0) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        try {
            await redisClient.del('entries:all');
            if (userId) {
                await redisClient.del(`entries:user:${userId}`);
            }
            console.log('[Redis] Cleared entries cache after deletion');
        } catch (err) {
            console.warn('[Redis] Cache invalidation error:', err.message);
        }

        res.json({ message: 'Entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin endpoint to fetch all entries
app.get('/api/admin/entries', async (req, res) => {
    try {
        await probeSupabase().catch(() => {});
        const sb = getSupabase();
        if (!sb || !dbReachable) {
            return res.json({ entries: [] });
        }
        const { data: rows, error } = await sb
            .from('journal_entries')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ entries: (rows || []).map(entryRowToClient) });
    } catch (error) {
        console.error('Error fetching admin entries:', error);
        res.status(500).json({ message: error.message });
    }
});

// Admin endpoint to fetch all users
app.get('/api/admin/users', async (req, res) => {
    try {
        await probeSupabase().catch(() => {});
        const sb = getSupabase();
        if (!sb || !dbReachable) {
            return res.json({ users: [] });
        }
        const { data: rows, error } = await sb
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        const users = (rows || []).map(userRowToClient);
        console.log('[Admin] Fetched users count:', users.length);
        res.json({ users });
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ message: error.message });
    }
});

// Debug endpoint to check database directly
app.get('/api/debug/db', async (req, res) => {
    try {
        await probeSupabase().catch(() => {});
        const sb = getSupabase();
        if (!sb) {
            return res.json({
                database: { connected: false, backend: 'supabase' },
                counts: { users: 0, entries: 0 },
                sampleUsers: [],
                sampleEntries: [],
            });
        }

        const [
            { count: userCount, error: userCountErr },
            { count: entryCount, error: entryCountErr },
            { data: users, error: usersErr },
            { data: entries, error: entriesErr },
        ] = await Promise.all([
            sb.from('user_profiles').select('*', { count: 'exact', head: true }),
            sb.from('journal_entries').select('*', { count: 'exact', head: true }),
            sb.from('user_profiles').select('*').limit(5),
            sb.from('journal_entries').select('*').limit(5),
        ]);

        if (userCountErr) throw userCountErr;
        if (entryCountErr) throw entryCountErr;
        if (usersErr) throw usersErr;
        if (entriesErr) throw entriesErr;

        res.json({
            database: {
                connected: dbReachable,
                backend: 'supabase',
            },
            counts: {
                users: userCount ?? 0,
                entries: entryCount ?? 0,
            },
            sampleUsers: (users || []).map(userRowToClient),
            sampleEntries: (entries || []).map(entryRowToClient),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth sync endpoint
app.post('/api/auth/sync-user', async (req, res) => {
    try {
        console.log('[Sync User] Request received:', req.body);

        if (!req.body?.profile) {
            console.log('[Sync User] Missing profile payload');
            return res.status(400).json({ message: 'Missing profile payload.' });
        }

        const { profile } = req.body;

        const update = {
            clerkId: profile.userId,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            imageUrl: profile.imageUrl,
        };

        await probeSupabase().catch(() => {});
        const sb = getSupabase();
        if (!sb || !dbReachable) {
            console.warn('[Sync User] Supabase not reachable; skipping persistence (login still succeeds)');
            return res.json({
                degraded: true,
                user: { ...update },
            });
        }

        console.log('[Sync User] Updating user:', update);

        const { data: row, error } = await sb
            .from('user_profiles')
            .upsert(
                {
                    clerk_id: profile.userId,
                    email: profile.email || '',
                    first_name: profile.firstName || '',
                    last_name: profile.lastName || '',
                    image_url: profile.imageUrl || '',
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'clerk_id' },
            )
            .select()
            .single();

        if (error) throw error;

        console.log('[Sync User] User synced:', row);
        res.json({ user: userRowToClient(row) });
    } catch (error) {
        console.error('[Sync User] Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Start server with SO_REUSEADDR
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        redisClient.quit();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        redisClient.quit();
        process.exit(0);
    });
});
