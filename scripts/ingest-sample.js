import { ingestText, answerQuestion } from '../src/ragService.js';

async function main() {
  const sample = `Hostinger is a web hosting company. Its Node.js hosting plans let you
deploy applications by uploading your project files, setting the entry point (e.g. server.js),
and configuring environment variables through hPanel. Applications are typically kept alive
with a process manager, and the platform maps a public domain to your app's port.`;

  console.log('Ingesting sample document...');
  const { documentId, chunkCount } = await ingestText(sample, { source: 'sample-doc' });
  console.log(`Ingested documentId=${documentId} with ${chunkCount} chunk(s).`);

  console.log('\nAsking a test question...');
  const result = await answerQuestion('How do you deploy a Node.js app on Hostinger?');
  console.log('\nAnswer:\n', result.answer);
  console.log('\nSources:\n', result.sources);
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
