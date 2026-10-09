import { ServerEnvSchema, type Env } from './env-schema.js';

/** Central, validated config. Import this — never read process.env ad hoc elsewhere. */
export const config: Env = ServerEnvSchema.parse(process.env);
