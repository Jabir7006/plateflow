import { createServer } from "node:http";
import app from "./app.js";
import { ENV } from "./config/env.js";
import { initRealtime } from "./realtime/realtime.js";

const { PORT } = ENV;

// socket.io needs the raw HTTP server to attach to, so we create it explicitly
// and hand Express to it rather than calling app.listen directly.
const httpServer = createServer(app);
initRealtime(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
