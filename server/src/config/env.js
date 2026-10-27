import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  MONGO_URI: z.string().trim().min(1),
  JWT_SECRET: z.string().trim().min(1),
  CLIENT_URL: z.string().url(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_BASE_URL: z.string().url().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_FALLBACK_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.preprocess(
    (value) => (typeof value === 'string' && !value.trim() ? undefined : value),
    z.string().default('gemini-embedding-001'),
  ),
  EMBEDDING_DIMENSIONS: z.preprocess(
    (value) => (typeof value === 'string' && !value.trim() ? undefined : value),
    z.coerce.number().int().positive().default(768),
  ),
  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
  CLOUDINARY_API_KEY: z.string().trim().optional(),
  CLOUDINARY_API_SECRET: z.string().trim().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment configuration:');
  for (const issue of result.error.issues) {
    console.error(`- ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = Object.freeze({
  port: result.data.PORT,
  nodeEnv: result.data.NODE_ENV,
  mongoUri: result.data.MONGO_URI,
  jwtSecret: result.data.JWT_SECRET,
  clientUrl: result.data.CLIENT_URL,
  groqApiKey: result.data.GROQ_API_KEY,
  groqBaseUrl: result.data.GROQ_BASE_URL,
  llmModel: result.data.LLM_MODEL,
  llmFallbackModel: result.data.LLM_FALLBACK_MODEL,
  geminiApiKey: result.data.GEMINI_API_KEY,
  embeddingModel: result.data.EMBEDDING_MODEL,
  embeddingDimensions: result.data.EMBEDDING_DIMENSIONS,
  cloudinaryCloudName: result.data.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: result.data.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: result.data.CLOUDINARY_API_SECRET,
});
