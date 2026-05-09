import { z } from 'zod';

/** Flat shape — validates `req.body` directly */
export const registerDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});
