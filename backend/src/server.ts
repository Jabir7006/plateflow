import app from "./app.js";
import { ENV } from "./config/env.js";

const { PORT } = ENV;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
