import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'irrigation-dashboard-9hmuwzxk',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_ye8-GXe_2rDGJFGO1_ZuZe6YWCqik9wU',
  authRequired: false,
  auth: { mode: 'managed' },
})
