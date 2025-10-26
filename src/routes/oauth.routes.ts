import { Hono } from 'hono';
import { OAuthController } from '../controllers/oauth.controller';

const oauthRouter = new Hono();

oauthRouter.get('/authorize', OAuthController.authorize);
oauthRouter.post('/token', OAuthController.token);
oauthRouter.get('/userinfo', OAuthController.userinfo);

oauthRouter.get('/jwks', OAuthController.jwks);


export { oauthRouter };
