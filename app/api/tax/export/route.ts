import {NextResponse, type NextRequest} from 'next/server';

import {createSupabaseServerClient} from '@/lib/supabase/server';
import {buildTaxCsv, fetchTaxExportData, getWorkspaceIdForUser, parseExportYear} from '@/lib/tax/export';

export async function GET(request: NextRequest) {
  const year = parseExportYear(request.nextUrl.searchParams.get('year'));

  if (!year) {
    return NextResponse.json({error: 'Invalid year'}, {status: 400});
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const workspaceId = await getWorkspaceIdForUser(supabase, user.id);

  if (!workspaceId) {
    return NextResponse.json({error: 'Workspace not found'}, {status: 404});
  }

  const exportData = await fetchTaxExportData({supabase, workspaceId, year});

  if (exportData.error || !exportData.data) {
    return NextResponse.json({error: exportData.error ?? 'Export failed'}, {status: 500});
  }

  const csv = buildTaxCsv(exportData.data);

  return new NextResponse(csv, {
    headers: {
      'Content-Disposition': `attachment; filename="petit-bailleur-tax-${year}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8'
    }
  });
}
