// API base URL
// - Production: empty string (relative URLs, requires reverse proxy)
// - Local dev: set VITE_API_URL=http://localhost:8000
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
