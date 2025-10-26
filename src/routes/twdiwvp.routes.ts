import { Hono } from 'hono';
import { TWDIWVPController } from '../controllers/twdiwvp.controller';

const twdiwvpRouter = new Hono();

// Get VP ID
twdiwvpRouter.get('/id', TWDIWVPController.getId);

// Proxy all other methods and paths under /twdiwvp
twdiwvpRouter.all('*', TWDIWVPController.proxy);

export { twdiwvpRouter };
