import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { SceneSpecSchema } from '../web/src/scene/schema'
import { validateSceneSpec } from '../web/src/scene/validator'
import { parseRequest } from '../web/src/scene/parser'

export const config = {
  runtime: 'edge',
}

const SYSTEM = `You convert natural-language requests about hand anatomy/injury visualisation into a Handwerk SceneSpec JSON object.
Rules:
- version must be 1
- Only use bones/meshes from the schema enums
- Angles are degrees; stay within physiological joint limits
- For scaphoid fractures prefer location=waist unless specified; set displaced/fixation/healingWeek from the request
- Always set disclaimer: true
- Prefer clinical accuracy; keep captions concise and educational
- camera.view: dorsal|palmar|radial|ulnar|scaphoid|oblique`

function getModel() {
  const gateway = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  if (gateway) {
    const openai = createOpenAI({
      apiKey: gateway,
      baseURL: 'https://ai-gateway.vercel.sh/v1',
    })
    return openai(process.env.AI_MODEL || 'openai/gpt-4o-mini')
  }
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey })
    return openai(process.env.AI_MODEL || 'gpt-4o-mini')
  }
  return null
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() })
  }
  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405, headers: cors() })
  }

  const model = getModel()
  if (!model) {
    return Response.json(
      { error: 'No AI key configured', fallback: 'rules' },
      { status: 501, headers: cors() },
    )
  }

  let request = ''
  try {
    const body = await req.json()
    request = String(body.request ?? '')
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: cors() })
  }

  if (!request.trim()) {
    return Response.json({ error: 'Empty request' }, { status: 400, headers: cors() })
  }

  try {
    const { object } = await generateObject({
      model,
      schema: SceneSpecSchema,
      system: SYSTEM,
      prompt: request,
      temperature: 0.2,
    })
    const validated = validateSceneSpec(object)
    if (!validated.ok || !validated.spec) {
      const fallback = parseRequest(request)
      return Response.json(
        {
          spec: fallback.spec,
          notes: [
            'LLM output failed validation; used offline parser',
            ...validated.issues.map((i) => i.message),
          ],
          source: 'rules',
        },
        { headers: cors() },
      )
    }
    return Response.json(
      {
        spec: validated.spec,
        notes: validated.issues.map((i) => i.message),
        source: 'llm',
      },
      { headers: cors() },
    )
  } catch (err) {
    const fallback = parseRequest(request)
    return Response.json(
      {
        spec: fallback.spec,
        notes: [
          `LLM error: ${err instanceof Error ? err.message : 'unknown'}`,
          'fell back to rules',
        ],
        source: 'rules',
      },
      { headers: cors() },
    )
  }
}

function cors(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
