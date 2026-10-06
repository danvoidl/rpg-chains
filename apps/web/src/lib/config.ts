// Central client config. Next inlines `NEXT_PUBLIC_*` at build time; read them only here.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is required');

export const config = { apiUrl };
