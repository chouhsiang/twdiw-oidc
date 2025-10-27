import { Hono } from 'hono';
import { oauthRouter } from './routes/oauth.routes';

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

export default app;
