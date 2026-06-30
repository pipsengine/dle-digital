import { NextResponse } from 'next/server';
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { saveLeaveAttachment } from '@/lib/leave-workflow-service';

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const err = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });

const tokenFrom = (request: Request) =>
  request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${AUTH_COOKIE}=`))?.split('=').slice(1).join('=');

export async function POST(request: Request) {
  try {
    const session = await verifySessionToken(tokenFrom(request) ? decodeURIComponent(tokenFrom(request) || '') : '');
    if (!session) return err(401, 'Unauthenticated.');

    const form = await request.formData();
    const requestId = String(form.get('requestId') || '').trim();
    const file = form.get('file');
    if (!requestId) return err(400, 'requestId is required.');
    if (!(file instanceof File)) return err(400, 'file is required.');
    if (file.size > 5 * 1024 * 1024) return err(400, 'Attachment must be 5 MB or smaller.');

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileName = await saveLeaveAttachment(requestId, file.name || 'attachment.bin', bytes);
    return ok({ requestId, fileName });
  } catch (error) {
    return err(500, error instanceof Error ? error.message : 'Unable to upload leave attachment.');
  }
}
