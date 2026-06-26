import { requireAdminAuth } from '../_lib/basic-auth.js';

export async function onRequest(context) {
  const denied = requireAdminAuth(context.request, context.env);
  if (denied) return denied;
  return context.next();
}
