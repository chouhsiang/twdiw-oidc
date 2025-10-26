import { Context } from "hono";

interface VerifierResponse {
  data: Array<{
    claims: {
      Email: string;
    };
  }>;
}

declare module "hono" {
  interface ContextVariableMap {
    OIDC_PRIVATEKEY: string;
  }
}

export class OAuthController {
  static async authorize(c: Context) {
    // Your OAuth authorization logic here
    return c.json({ message: "OAuth authorize endpoint" });
  }

  static async token(c: Context) {
    const { env, req } = c;

    const formData = await req.formData();
    const code = formData.get("code");

    // 取得私鑰
    const oidcKeyBase64 = env.OIDC_KEY;
    const keyStr = atob(oidcKeyBase64);
    const keyJson = JSON.parse(keyStr);

    const url = c.env.TWDIW_VP_URL + "/api/oidvp/result";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: code }),
    });

    const json: any = await res.json();

    const claims = json[0]?.claims || [];

    // 取出 name 和 email
    const name = claims.find((c: any) => c.ename === "name")?.value;
    const email = claims.find((c: any) => c.ename === "email")?.value;

    const privateKey = await crypto.subtle.importKey(
      "jwk",
      keyJson,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" },
      },
      true,
      ["sign"]
    );

    const header = {
      alg: "RS256",
      typ: "JWT",
      kid: "1",
    };

    const payload = {
      email,
      name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      iat: Math.floor(Date.now() / 1000),
    };

    // 產生 id_token
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    const signature = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      privateKey,
      new TextEncoder().encode(dataToSign)
    );
    const encodedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signature))
    );
    const idToken = `${dataToSign}.${encodedSignature}`;

    console.log(idToken);
    return c.json({ id_token: idToken });  
  }

  static async userinfo(c: Context) {
    // Your user info endpoint logic here
    return c.json({ message: "User info endpoint" });
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
      response_types_supported: ["code", "token", "id_token"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "profile", "email"],
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
      ],
      claims_supported: ["sub", "iss", "name", "email"],
    });
  }

  // JWKS endpoint
  static async jwks(c: Context) {
    try {
      const { env } = c;
      const oidcKeyBase64 = env.OIDC_KEY;

      if (!oidcKeyBase64) {
        throw new Error("OIDC_KEY not configured in environment");
      }

      // Decode base64 to string in a Cloudflare Workers compatible way
      const keyStr = atob(oidcKeyBase64);
      const keyJson = JSON.parse(keyStr);

      // Extract public key components
      const { e, n, kty } = keyJson;

      // Create the JWKS response with only public key components
      const jwks = {
        keys: [
          {
            kty,
            n,
            e,
            kid: "1",
            use: "sig",
            alg: "RS256",
          },
        ],
      };

      return c.json(jwks);
    } catch (error) {
      console.error("Error generating JWKS:", error);
      return c.json({ error: "Failed to generate JWKS" }, 500);
    }
  }
}
