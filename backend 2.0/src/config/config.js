// backend/config.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend 2.0 project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

