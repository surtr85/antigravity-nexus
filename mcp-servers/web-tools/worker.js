export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Proxy Active', { status: 200 });
    }

    try {
      const { target_url, headers, body } = await request.json();

      if (!target_url) {
        return new Response(JSON.stringify({ error: 'target_url is required' }), { status: 400 });
      }

      const response = await fetch(target_url, {
        method: 'POST',
        headers: headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const responseText = await response.text();
      return new Response(responseText, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
};
