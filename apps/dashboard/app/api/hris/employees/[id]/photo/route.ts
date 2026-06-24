import { readEmployeePhotoFromDb } from '@/lib/dle-enterprise-db';

export const runtime = 'nodejs';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const employeeCode = decodeURIComponent(id || '').trim();
  if (!employeeCode) {
    return new Response('Employee code is required.', { status: 400 });
  }

  const photo = await readEmployeePhotoFromDb(employeeCode);
  if (!photo?.data?.length) {
    return new Response('Photo not found.', { status: 404 });
  }

  return new Response(new Uint8Array(photo.data), {
    status: 200,
    headers: {
      'Content-Type': photo.mimeType || 'image/jpeg',
      'Content-Length': String(photo.data.length),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
