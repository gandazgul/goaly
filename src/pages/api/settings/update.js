import { db } from '../../../db/index.js';
import { getUserFromRequest } from '../../../lib/auth.js';

/** @type {import('astro').APIRoute} */
export const POST = async ({ request, redirect }) => {
  const user = getUserFromRequest(request);

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const formData = await request.formData();
    const gotifyUrl = formData.get('gotify_url') || null;
    const gotifyToken = formData.get('gotify_token') || null;

    db.prepare(`
      UPDATE users 
      SET gotify_url = ?, gotify_token = ? 
      WHERE id = ?
    `).run(gotifyUrl, gotifyToken, user.id);

    return redirect('/profile?success=SettingsSaved');
  } catch (error) {
    console.error('Failed to update settings:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};