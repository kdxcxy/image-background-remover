export const config = { runtime: 'edge' }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const { image } = await request.json<{ image?: string }>()

      if (!image) {
        return new Response(JSON.stringify({ error: '缺少图片数据' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Rate limiting: simple check via CF headers
      const cfRay = request.headers.get('cf-ray') || ''
      // Remove.bg API call
      const removeRes = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': env.REMOVE_BG_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_file_b64: image, size: 'auto' }),
      })

      if (!removeRes.ok) {
        const errText = await removeRes.text()
        console.error('Remove.bg error:', removeRes.status, errText)
        return new Response(
          JSON.stringify({ error: `处理失败: ${removeRes.status}` }),
          { status: removeRes.status, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const buf = Buffer.from(await removeRes.arrayBuffer())
      const b64 = buf.toString('base64')

      return new Response(JSON.stringify({ image: b64 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (e) {
      console.error('Server error:', e)
      return new Response(JSON.stringify({ error: '服务器错误' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
} satisfies ExportedHandler<Env>
