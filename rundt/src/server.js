import { createServer } from 'node:http';
import { lagBehandler } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const server = createServer(lagBehandler());

server.listen(port, () => {
  console.log(`rundt lytter på :${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
