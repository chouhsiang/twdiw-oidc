import { Hono } from 'hono';
import { OAuthController } from '../controllers/oauth.controller';

const oauthRouter = new Hono();

oauthRouter.post('/token', OAuthController.token);
oauthRouter.get('/jwks', OAuthController.jwks);
oauthRouter.get('/login/qrcode', OAuthController.loginQrcode);
oauthRouter.get('/login/result', OAuthController.loginResult);


export { oauthRouter };
