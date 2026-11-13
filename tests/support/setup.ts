import { config } from "dotenv";

// Integration tests read real credentials from .env.test.local (never committed).
config({ path: ".env.test.local", quiet: true });
config({ path: ".env.local", quiet: true });
