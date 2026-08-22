import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  appApiKey: process.env.APP_API_KEY || '',

  gemini: {
    apiKey: required('GEMINI_API_KEY'),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.3'),
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '1024'),
  },

  embedding: {
    // Same GEMINI_API_KEY is reused for embeddings -- one key, two capabilities.
    model: process.env.EMBEDDING_MODEL || 'gemini-embedding-001',
    // gemini-embedding-001 supports 768, 1536, or 3072. Smaller = less storage,
    // still strong retrieval quality for project-scale knowledge bases.
    dimension: parseInt(process.env.EMBEDDING_DIMENSION || '768', 10),
  },

  vectorStore: {
    // Local JSON-file vector store -- no external database needed.
    // NOTE: on most free hosts (including Render's free tier) the filesystem
    // is ephemeral and resets on redeploy/restart. Fine for a demo/project;
    // re-ingest your documents after a redeploy if data disappears.
    path: process.env.VECTOR_STORE_PATH || './data/vectorstore.json',
  },

  rag: {
    chunkSize: parseInt(process.env.CHUNK_SIZE || '1000', 10),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '150', 10),
    topK: parseInt(process.env.TOP_K || '5', 10),
    maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '15', 10),
  },
};
