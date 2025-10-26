import { Context } from 'hono';

export class TWDIWVCController {
  static async getId(c: Context) {
    const { env } = c;
    return c.json({ id: env.TWDIW_VC_ID });
  }

  static async proxy(c: Context) {
    const { env } = c;
    const API_URL = env.TWDIW_VC_URL;
    const API_TOKEN = env.TWDIW_VC_TOKEN;

    const url = new URL(c.req.url);
    const { search } = url;
    const pathname = url.pathname.replaceAll('/api/twdiwvc', '/api');

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: c.req.method,
      headers: {
        'Access-Token': API_TOKEN,
      },
    };

    // Only add body and Content-Type for non-GET requests
    if (c.req.method !== 'GET') {
      const body = await c.req.text();
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Content-Type': 'application/json',
      };
      if (body) {
        fetchOptions.body = body;
      }
    }

    try {
      const response = await fetch(`${API_URL}${pathname}${search}`, fetchOptions);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to proxy request' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
}
