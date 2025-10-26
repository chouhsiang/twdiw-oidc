import { Hono } from 'hono';
import { oauthRouter } from './routes/oauth.routes';
import { twdiwvpRouter } from './routes/twdiwvp.routes';
import { twdiwvcRouter } from './routes/twdiwvc.routes';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// API Routes
const api = new Hono();
api.route('/oauth', oauthRouter);
api.route('/twdiwvp', twdiwvpRouter);
api.route('/twdiwvc', twdiwvcRouter);

// Mount API under /api
app.route('/api', api);

// Health check endpoint
app.get('/', (c) => {
  return c.text('OIDC Server is running');
});

export default app;
