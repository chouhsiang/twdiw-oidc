import { Hono } from 'hono';
import { TWDIWVCController } from '../controllers/twdiwvc.controller';

const twdiwvcRouter = new Hono();

// Get VC ID
twdiwvcRouter.get('/id', TWDIWVCController.getId);

// Proxy all other methods and paths under /twdiwvc
twdiwvcRouter.all('*', TWDIWVCController.proxy);

export { twdiwvcRouter };
