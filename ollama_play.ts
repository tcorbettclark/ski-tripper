import { Ollama } from 'ollama'
import * as z from 'zod'
import type { JSONSchema } from 'zod/v4/core'

const jsonCodec = <T extends z.core.$ZodType>(schema: T) =>
  z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString)
      } catch (err) {
        if (err instanceof SyntaxError) {
          ctx.issues.push({
            code: 'invalid_format',
            format: 'json',
            input: jsonString,
            message: err.message,
          })
          return z.NEVER
        }
        throw err
      }
    },
    encode: (value) => JSON.stringify(value),
  })

type ToolDef = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description: string }>
      required: string[]
    }
  }
}

async function callLLM(
  ollama: Ollama,
  jsonResponseSchema: JSONSchema.JSONSchema,
  toolDefs: ToolDef[],
  tools: Function[],
  content: string
) {
  const zodResponseSchema = z.fromJSONSchema(jsonResponseSchema)
  const responseCodec = jsonCodec(zodResponseSchema)
  const response = await ollama.chat({
    stream: false as const,
    // model: 'gpt-oss:120b',
    model: 'kimi-k2.6:cloud',
    // model: 'deepseek-v4-pro:cloud',
    // thinking: 'high',
    messages: [
      {
        role: 'system',
        content: `Use tools if applicable. The final answer MUST be in raw json with the following schema: ${JSON.stringify(jsonResponseSchema)}`,
      },
      { role: 'user', content: content },
    ],
    tools: toolDefs,
    // options: {
    //   temperature: 0, // Make responses more deterministic
    // },
  })

  console.log(response)

  if (response.message.tool_calls) {
    for (const toolCall of response.message.tool_calls) {
      console.log(toolCall)
      // const tool = tools.find((t) => t.function.name === toolCall.function.name)
      // if (tool) {
      //   const result = await tool(tool.function.parameters)
      //   if (result) {
      //     return result
      //   }
      // }
    }
  }

  try {
    return responseCodec.decode(response.message.content, {
      reportInput: true, // Include the input in error messages
    })
  } catch (err) {
    process.stderr.write(err instanceof Error ? err.message : String(err))
  }
}

const ollama = new Ollama({
  host: 'https://ollama.com',
  headers: { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
})

const jsonSchema: JSONSchema.JSONSchema = {
  type: 'object',
  properties: {
    as_number: {
      description: 'The result as a number',
      type: 'number',
    },
    as_string: {
      description: 'The result as a string',
      type: 'string',
    },
  },
  required: ['as_number', 'as_string'],
}

const celciusToFahrenheitTool: ToolDef = {
  type: 'function',
  function: {
    name: 'celciusToFahrenheit',
    description: 'Convert Celcius to Fahrenheit',
    parameters: {
      type: 'object',
      properties: {
        celcius: { type: 'number', description: 'Temperature unit' },
      },
      required: ['celcius'],
    },
  },
}

function celciusToFahrenheit(celcius: number): number {
  return (celcius * 9) / 5 + 32
}

const answer = await callLLM(
  ollama,
  jsonSchema,
  [celciusToFahrenheitTool],
  [celciusToFahrenheit],
  'What is 43 Celcius in Fahrenheit?'
)
process.stdout.write(JSON.stringify(answer, null, 2))
