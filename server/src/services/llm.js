import OpenAI from 'openai';
import { config } from '../config/env.js';
import AppError from '../utils/AppError.js';

const unavailableMessage = 'AI is temporarily unavailable. You can continue without it.';
let client;

function getClient() {
  if (!config.groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }
  if (!config.groqBaseUrl || !config.llmModel) {
    throw new Error('LLM configuration is incomplete');
  }
  client ??= new OpenAI({
    apiKey: config.groqApiKey,
    baseURL: config.groqBaseUrl,
    timeout: 20_000,
  });
  return client;
}

function logFailure(error, model) {
  const message = config.groqApiKey
    ? error.message?.replaceAll(config.groqApiKey, '[REDACTED]')
    : error.message;
  console.error('LLM request failed:', {
    message,
    status: error.status,
    model,
  });
}

function canRetryWithFallback(error) {
  const status = error.status ?? error.statusCode;
  const message = error.message?.toLowerCase() ?? '';
  return status === 429
    || (status >= 500 && status <= 599)
    || message.includes('model') && (
      message.includes('not found')
      || message.includes('does not exist')
      || message.includes('unknown model')
    );
}

function completionRequest(model, {
  messages,
  tools,
  temperature,
  json,
  jsonSchema,
  maxTokens,
}) {
  const responseFormat = jsonSchema && model.startsWith('openai/gpt-oss-')
    ? {
      type: 'json_schema',
      json_schema: {
        name: 'event_extraction',
        strict: true,
        schema: jsonSchema,
      },
    }
    : json ? { type: 'json_object' } : undefined;

  return {
    model,
    messages,
    temperature,
    max_completion_tokens: maxTokens,
    ...(model.startsWith('openai/gpt-oss-')
      ? { reasoning_effort: 'low', include_reasoning: false }
      : {}),
    ...(tools ? { tools } : {}),
    ...(responseFormat ? { response_format: responseFormat } : {}),
  };
}

export async function chat({
  messages,
  tools,
  temperature = 0.4,
  json = false,
  jsonSchema,
  maxTokens = 600,
}) {
  let currentModel = config.llmModel;
  try {
    const openai = getClient();

    try {
      const completion = await openai.chat.completions.create(
        completionRequest(currentModel, {
          messages,
          tools,
          temperature,
          json,
          jsonSchema,
          maxTokens,
        }),
      );
      return completion.choices[0].message;
    } catch (error) {
      if (!canRetryWithFallback(error) || !config.llmFallbackModel) {
        throw error;
      }

      logFailure(error, config.llmModel);
      currentModel = config.llmFallbackModel;
      const fallbackCompletion = await openai.chat.completions.create(
        completionRequest(currentModel, {
          messages,
          tools,
          temperature,
          json,
          jsonSchema,
          maxTokens,
        }),
      );
      return fallbackCompletion.choices[0].message;
    }
  } catch (error) {
    logFailure(error, currentModel);
    throw new AppError('AI_UNAVAILABLE', unavailableMessage, 503);
  }
}

export async function chatJSON({ messages, schema, ...options }) {
  let promptMessages = messages;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const message = await chat({ ...options, messages: promptMessages, json: true });
    try {
      const parsed = JSON.parse(message.content);
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
      console.error('LLM JSON failed schema validation:', {
        attempt: attempt + 1,
        contentLength: message.content?.length ?? 0,
        issues: result.error.issues.map(({ path, message: issueMessage }) => ({
          path: path.join('.'),
          message: issueMessage,
        })),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('LLM JSON parse failed:', {
        attempt: attempt + 1,
        contentLength: message.content?.length ?? 0,
        message: error.message,
      });
    }

    if (attempt === 0) {
      promptMessages = [
        ...messages,
        { role: 'user', content: 'Return only valid JSON matching the requested shape' },
      ];
    }
  }

  console.error('LLM returned invalid JSON after retry');
  throw new AppError('AI_UNAVAILABLE', unavailableMessage, 503);
}
