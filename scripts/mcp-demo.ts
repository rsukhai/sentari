/**
 * ДРУГИЙ БІК (крок 09): застосунок викликає ті самі інструменти MCP-сервера sentari-obd.
 * Процес сервера породжує транспорт — окремо запускати сервер не треба й не можна.
 * Потрібна локальна Ollama (search_corpus ембедить запит); ключів API не потрібно.
 *
 *   npx tsx scripts/mcp-demo.ts "What happens if the EGR valve is clogged?"
 */
import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const query = process.argv[2] ?? 'Can I clean a dirty MAF sensor with brake cleaner?';

const client = new Client({ name: 'sentari-app', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp/server.ts'],
  cwd: process.cwd(),
  // НЕ ...process.env: інакше серверу дісталися б усі секрети застосунку.
  // MCP_CLIENT_LABEL — підпис у журналі сервера: за ним видно, що виклик ЗВІДСИ.
  env: { ...getDefaultEnvironment(), MCP_CLIENT_LABEL: 'sentari-app' },
});

function show(title: string, result: Awaited<ReturnType<typeof client.callTool>>): void {
  console.log(`\n### ${title}`);
  // тип блоку перевіряємо ДО читання .text
  for (const block of result.content) {
    if (block.type === 'text') console.log(block.text.length > 600 ? `${block.text.slice(0, 600)}…` : block.text);
  }
  if (result.isError) console.log('^ це ВІДМОВА сервера (isError: true), і вона очікувана');
}

async function main() {
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    for (const tool of tools) console.log(`${tool.name} — ${tool.description ?? ''}`);
    show(`search_corpus «${query}», topK 3`, await client.callTool({ name: 'search_corpus', arguments: { query, topK: 3 } }));
    show('fetch_chunk maf#0008', await client.callTool({ name: 'fetch_chunk', arguments: { id: 'maf#0008' } }));
    // третій виклик навмисно за межею: доказ, що застосунок бачить відмову
    show('fetch_chunk maf#9999 (немає в індексі)', await client.callTool({ name: 'fetch_chunk', arguments: { id: 'maf#9999' } }));
  } finally {
    // без close() процес сервера залишиться живим
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
