import { Hono } from 'hono';
import { oauthRouter } from './routes/oauth.routes';
import { Context } from "hono";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// API Routes
const api = new Hono();
api.route('/oauth', oauthRouter);
// Mount API under /api
app.route('/api', api);

// Health check endpoint
app.get('/', (c) => {
  return c.text('OIDC Server is running');
});

app.get('/init-db', async (c: Context) => {
  const env = c.env

  // 檢查 clients 表是否存在
  const result = await env.DB.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='clients';
  `).first();

  if (result) {
    return c.text('✅ Table "clients" already exists.');
  }

  // 建立 clients 表
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE,
      client_secret TEXT,
      name TEXT,
      redirect_uris TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `).run();

  return c.text('✅ Table "clients" created successfully.')
})


export default app;
