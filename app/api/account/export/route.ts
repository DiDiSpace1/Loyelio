import {NextResponse} from 'next/server';

import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getWorkspaceIdForUser} from '@/lib/tax/export';

async function fetchTable(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, table: string, workspaceId: string) {
  const {data, error} = await supabase.from(table).select('*').eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function GET() {
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

  try {
    const {data: profile} = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const {data: workspace} = await supabase.from('workspaces').select('*').eq('id', workspaceId).single();
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      tables: {
        documents: await fetchTable(supabase, 'documents', workspaceId),
        expenses: await fetchTable(supabase, 'expenses', workspaceId),
        leases: await fetchTable(supabase, 'leases', workspaceId),
        properties: await fetchTable(supabase, 'properties', workspaceId),
        rent_charges: await fetchTable(supabase, 'rent_charges', workspaceId),
        rent_payments: await fetchTable(supabase, 'rent_payments', workspaceId),
        tax_exports: await fetchTable(supabase, 'tax_exports', workspaceId),
        tenants: await fetchTable(supabase, 'tenants', workspaceId),
        units: await fetchTable(supabase, 'units', workspaceId),
        workspace_billing: await fetchTable(supabase, 'workspace_billing', workspaceId)
      },
      workspace
    };

    return NextResponse.json(payload, {
      headers: {
        'Content-Disposition': 'attachment; filename="petit-bailleur-data-export.json"'
      }
    });
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : 'Export failed'}, {status: 500});
  }
}
