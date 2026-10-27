import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('openai', () => ({
  default: vi.fn(function OpenAIClient() {}),
}));

const testConfig = {
  groqApiKey: 'test-key',
  groqBaseUrl: 'https://llm.example.test/v1',
  llmModel: 'primary-model',
  llmFallbackModel: 'fallback-model',
};

async function loadLlm(config = testConfig) {
  vi.resetModules();
  vi.doMock('../src/config/env.js', () => ({ config }));
  return import('../src/services/llm.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('llm service', () => {
  it('retries a primary-model 429 once with the fallback model', async () => {
    const { chat } = await loadLlm({
      ...testConfig,
      llmModel: 'openai/gpt-oss-120b',
      llmFallbackModel: 'openai/gpt-oss-20b',
    });
    const { default: OpenAI } = await import('openai');
    const create = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Rate limited'), { status: 429 }))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Fallback response' } }],
      });
    OpenAI.mockImplementation(function OpenAIClient() {
      return {
      chat: { completions: { create } },
      };
    });

    const result = await chat({ messages: [{ role: 'user', content: 'Hello' }] });

    expect(result.content).toBe('Fallback response');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map(([request]) => request.model)).toEqual([
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ]);
    expect(create.mock.calls[0][0]).toMatchObject({
      max_completion_tokens: 600,
      reasoning_effort: 'low',
      include_reasoning: false,
    });
  });

  it('returns AI_UNAVAILABLE when the API key is missing', async () => {
    const { chat } = await loadLlm({ ...testConfig, groqApiKey: undefined });
    const { default: OpenAI } = await import('openai');
    await expect(chat({ messages: [{ role: 'user', content: 'Hello' }] }))
      .rejects.toMatchObject({
        code: 'AI_UNAVAILABLE',
        statusCode: 503,
      });
    expect(OpenAI).not.toHaveBeenCalled();
  });

  it('retries invalid JSON once with the requested shape reminder', async () => {
    const { chatJSON } = await loadLlm({
      ...testConfig,
      llmModel: 'openai/gpt-oss-120b',
      llmFallbackModel: 'openai/gpt-oss-20b',
    });
    const { default: OpenAI } = await import('openai');
    const create = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: '{invalid' } }] })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ title: 'Extracted' }) } }],
      });
    OpenAI.mockImplementation(function OpenAIClient() {
      return {
        chat: { completions: { create } },
      };
    });

    const jsonSchema = {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
      additionalProperties: false,
    };
    const result = await chatJSON({
      messages: [{ role: 'user', content: 'Extract an event' }],
      schema: z.object({ title: z.string() }),
      jsonSchema,
    });

    expect(result).toEqual({ title: 'Extracted' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages.at(-1)).toEqual({
      role: 'user',
      content: 'Return only valid JSON matching the requested shape',
    });
    expect(create.mock.calls[0][0].response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'event_extraction',
        strict: true,
        schema: jsonSchema,
      },
    });
  });
});
