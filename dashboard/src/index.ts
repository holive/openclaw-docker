import { buildServer } from './server.js';
import { config } from './config.js';

async function main() {
  const server = await buildServer();

  try {
    await server.listen({ port: config.port, host: config.host });
    console.log(`dashboard ready at http://${config.host}:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
