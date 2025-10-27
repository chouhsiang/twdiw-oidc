import { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sign } from 'hono/jwt'


export class OAuthController {
  static async token(c: Context) {
    const { env, req } = c;

    const formData = await req.formData();
    const code = formData.get("code");

    const raw = await c.env.CODE_KV.get(code);
    if (!raw) {
      return c.json({ error: "CODE 已過期或不存在" }, 401);
    }

    // 取出 name 和 email
    const data = JSON.parse(raw);
    const name = data.name;
    const email = data.email;

    const keyJson = JSON.parse(atob(env.OIDC_KEY));

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

    const jwt = await sign(payload, keyJson)
    return c.json({ id_token: jwt });
  }

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

  static async loginQrcode(c: Context) {
    const { env } = c;
    const apiUrl = env.TWDIW_VP_URL;
    const ref = env.TWDIW_VP_ID;
    const sessionId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    const url = `${apiUrl}/api/oidvp/qrcode?ref=${ref}&transactionId=${transactionId}`;
    const res = await fetch(url, {
      headers: {
        "Access-Token": env.TWDIW_VP_TOKEN,
      },
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const qrcodeImage = data.qrcodeImage;
      const authUri = data.authUri;

      await env.SESSION_KV.put(sessionId, JSON.stringify({ transactionId }), {
        expirationTtl: 3600,
      });
      setCookie(c, "sessionId", sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
        maxAge: 3600,
      });

      return c.json({ qrcodeImage, authUri });
    } else {
      return c.json(
        {
          error: true,
          message: "取得 QR Code 失敗",
        },
        500
      );
    }
  }

  static async loginResult(c: Context) {
    const sessionId = getCookie(c, "sessionId");
    if (!sessionId) {
      return c.json({ error: "沒有 sessionId，請先登入" }, 401);
    }

    const raw = await c.env.SESSION_KV.get(sessionId);
    if (!raw) {
      return c.json({ error: "Session 已過期或不存在" }, 401);
    }

    const session = JSON.parse(raw);
    const transactionId = session.transactionId;

    const { env } = c;
    const apiUrl = env.TWDIW_VP_URL;

    const url = `${apiUrl}/api/oidvp/result`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": env.TWDIW_VP_TOKEN,
      },
      body: JSON.stringify({ transactionId }),
    });

    if (res.ok) {
      const data = (await res.json()) as any;

      const email = data.data[0].claims.find(
        (c: any) => c.ename === "email"
      )?.value;
      const name = data.data[0].claims.find(
        (c: any) => c.ename === "name"
      )?.value;

      session.email = email;
      session.name = name;
      console.log(session);
      await env.SESSION_KV.put(sessionId, JSON.stringify(session), {
        expirationTtl: 3600,
      });

      const code = crypto.randomUUID();
      await env.CODE_KV.put(code, JSON.stringify(session), {
        expirationTtl: 60,
      });
      return c.json({ code });
    } else {
      return c.json(
        {
          message: "等待驗證",
        },
        500
      );
    }
  }
}
