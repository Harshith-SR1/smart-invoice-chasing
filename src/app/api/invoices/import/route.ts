import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AccountService, isUuid } from '@/services/accountService';

export async function POST(req: NextRequest) {
  try {
    const supabaseUser = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required. Please log in to import invoices.',
          totalRows: 0,
          importedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          rejectedCount: 0,
          errors: ['Authentication required.'],
          rowResults: [],
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { invoices, fileName, batchId, duplicatePolicy, workspaceId: clientWsId } = body;

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No invoice records provided for import.',
          totalRows: 0,
          importedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          rejectedCount: 0,
          errors: ['Empty invoice array provided.'],
          rowResults: [],
        },
        { status: 400 }
      );
    }

    // Server-side workspace derivation:
    // If a clientWsId is provided, verify ownership or membership.
    // If not provided, fetch the user's primary workspace.
    let targetWorkspaceId: string | null = null;

    if (clientWsId && isUuid(clientWsId) && clientWsId !== 'ws-default') {
      const { data: ws } = await supabaseUser
        .from('workspaces')
        .select('id, user_id')
        .eq('id', clientWsId)
        .maybeSingle();

      if (ws && ws.user_id === user.id) {
        targetWorkspaceId = ws.id;
      } else {
        const { data: member } = await supabaseUser
          .from('workspace_members')
          .select('id')
          .eq('workspace_id', clientWsId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (member) {
          targetWorkspaceId = clientWsId;
        }
      }
    }

    if (!targetWorkspaceId) {
      const { data: ws } = await supabaseUser
        .from('workspaces')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      targetWorkspaceId = ws?.id || null;
    }

    if (!targetWorkspaceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authorized workspace not found for authenticated user.',
          totalRows: invoices.length,
          importedCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          rejectedCount: invoices.length,
          errors: ['No authorized workspace found.'],
          rowResults: [],
        },
        { status: 403 }
      );
    }

    // Execute server-authorised batch import
    const accountService = AccountService.getInstance();
    const result = await accountService.importInvoicesBatch(targetWorkspaceId, invoices, {
      fileName,
      batchId,
      duplicatePolicy: duplicatePolicy || 'update',
      supabaseClient: supabaseUser,
    });

    const status = result.success ? 200 : result.planLimitExceeded ? 403 : 207;
    return NextResponse.json(result, { status });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Server error during invoice import.',
        totalRows: 0,
        importedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        rejectedCount: 0,
        errors: [err?.message || 'Server error'],
        rowResults: [],
      },
      { status: 500 }
    );
  }
}
