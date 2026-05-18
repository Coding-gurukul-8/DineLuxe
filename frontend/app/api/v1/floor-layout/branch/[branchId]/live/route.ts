import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:4000/api/v1';

/**
 * GET /api/v1/floor-layout/branch/[branchId]/live
 *
 * Proxies to the backend: GET /floor-layout/branch/:branchId/live
 * Backend route: floor-layout.routes.ts → router.get('/branch/:branchId/live', authenticate, ctrl.getLiveLayout)
 *
 * Previously this returned hardcoded mock data and never called the backend.
 * Fixed to forward the request with the caller's Authorization header so the
 * backend can authenticate + return real live table statuses.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { branchId: string } }
) {
  const { branchId } = params;
  const backendUrl = `${BACKEND_URL}/floor-layout/branch/${branchId}/live`;

  const authHeader = req.headers.get('authorization');

  try {
    const backendRes = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      // Don't cache — this is a live status endpoint
      cache: 'no-store',
    });

    const data = await backendRes.json();

    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error('[floor-layout proxy] Failed to reach backend:', err);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: 'Could not reach backend' } },
      { status: 502 }
    );
  }
}
