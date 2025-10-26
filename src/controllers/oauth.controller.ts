import { Context } from 'hono';
import { importPKCS8, exportJWK, base64url } from 'jose';

declare module 'hono' {
  interface ContextVariableMap {
    OIDC_PRIVATEKEY: string;
  }
}

// Helper function to decode base64
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper function to read ASN.1 integer
function readASN1Integer(data: Uint8Array, offset: number): Uint8Array {
  if (data[offset] !== 0x02) {
    throw new Error('Expected ASN.1 INTEGER');
  }
  
  let length = data[offset + 1];
  let start = offset + 2;
  
  // Handle long form length
  if (length & 0x80) {
    const lengthBytes = length & 0x7f;
    length = 0;
    for (let i = 0; i < lengthBytes; i++) {
      length = (length << 8) | data[offset + 2 + i];
    }
    start += lengthBytes;
  }
  
  // Handle leading zero for positive numbers (DER encoding)
  if (data[start] === 0x00 && (data[start + 1] & 0x80)) {
    start++;
    length--;
  }
  
  return data.slice(start, start + length);
}

export class OAuthController {
  static async authorize(c: Context) {
    // Your OAuth authorization logic here
    return c.json({ message: 'OAuth authorize endpoint' });
  }

  static async token(c: Context) {
    try {
      const { env } = c;
      const formData = await c.req.formData();
      const code = formData.get('code');

      if (!code) {
        return c.json({ error: 'Missing authorization code' }, 400);
      }

      // Get the OIDC key from environment
      const oidcKeyBase64 = env.OIDC_KEY;
      if (!oidcKeyBase64) {
        throw new Error('OIDC_KEY not configured in environment');
      }

      // Parse the key
      const keyStr = atob(oidcKeyBase64);
      const keyJson = JSON.parse(keyStr);

      // Import the private key
      const privateKey = await crypto.subtle.importKey(
        'jwk',
        keyJson,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: { name: 'SHA-256' }
        },
        true,
        ['sign']
      );

      // Create JWT header and payload
      const header = {
        alg: 'RS256',
        typ: 'JWT',
        kid: '1'  // Using the same kid as in JWKS
      };

      // Get user info from the code (you might want to validate the code first)
      // For now, we'll use a placeholder email
      const email = `user-${Date.now()}@example.com`;

      const payload = {
        sub: 'user123',  // Subject (user id)
        email: email,
        name: 'User Name',
        iat: Math.floor(Date.now() / 1000),  // Issued at
        exp: Math.floor(Date.now() / 1000) + (60 * 60),  // Expires in 1 hour
        iss: new URL(c.req.url).origin,  // Issuer
        aud: 'your-client-id'  // Audience (client id)
      };

      // Encode header and payload
      const encodedHeader = btoa(JSON.stringify(header).replace(/[\u007F-\uFFFF]/g, chr => '\\u' + ('0000' + chr.charCodeAt(0).toString(16)).substr(-4))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const encodedPayload = btoa(JSON.stringify(payload).replace(/[\u007F-\uFFFF]/g, chr => '\\u' + ('0000' + chr.charCodeAt(0).toString(16)).substr(-4))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      // Create signature
      const dataToSign = `${encodedHeader}.${encodedPayload}`;
      const signature = await crypto.subtle.sign(
        { name: 'RSASSA-PKCS1-v1_5' },
        privateKey,
        new TextEncoder().encode(dataToSign)
      );
      
      // Convert signature to base64url
      const signatureArray = Array.from(new Uint8Array(signature));
      const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
      const encodedSignature = signatureBase64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Create JWT
      const idToken = `${dataToSign}.${encodedSignature}`;

      // Return the token response
      return c.json({
        access_token: idToken,  // In a real implementation, this would be a separate token
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 3600
      });
    } catch (error) {
      console.error('Error generating token:', error);
      return c.json({ error: 'Failed to generate token' }, 500);
    }
  }

  static async userinfo(c: Context) {
    // Your user info endpoint logic here
    return c.json({ message: 'User info endpoint' });
  }

  // OIDC Discovery endpoint
  static async discovery(c: Context) {
    const baseUrl = new URL(c.req.url).origin;
    
    return c.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
      token_endpoint: `${baseUrl}/api/oauth/token`,
      userinfo_endpoint: `${baseUrl}/api/oauth/userinfo`,
      jwks_uri: `${baseUrl}/api/oauth/jwks`,
      response_types_supported: ['code', 'token', 'id_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'profile', 'email'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      claims_supported: ['sub', 'iss', 'name', 'email'],
    });
  }

  // JWKS endpoint
  static async jwks(c: Context) {
    try {
      const { env } = c;
      const oidcKeyBase64 = env.OIDC_KEY;
      
      if (!oidcKeyBase64) {
        throw new Error('OIDC_KEY not configured in environment');
      }

      // Decode base64 to string in a Cloudflare Workers compatible way
      const keyStr = atob(oidcKeyBase64);
      const keyJson = JSON.parse(keyStr);
      
      // Extract public key components
      const { e, n, kty } = keyJson;
      
      // Create the JWKS response with only public key components
      const jwks = {
        keys: [{
          kty,
          n,
          e,
          kid: '1',
          use: 'sig',
          alg: 'RS256'
        }]
      };

      return c.json(jwks);
    } catch (error) {
      console.error('Error generating JWKS:', error);
      return c.json({ error: 'Failed to generate JWKS' }, 500);
    }
  }
}
