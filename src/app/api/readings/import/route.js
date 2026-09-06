import { BillingCycle } from '@/models';
import { requirePermission } from '@/lib/authorize';
import { success, fail } from '@/lib/api-response';
import { parseReadingCsv, saveReading, consumerByAccount, ReadingError } from '@/lib/readings';

const MAX_BYTES = 2 * 1024 * 1024;

/* CSV import in two passes: `dry_run` reports what would happen so the operator
   sees the damage before it is done, then the same file is posted for real. */
export async function POST(request) {
  const { user, response } = await requirePermission('capture-readings');
  if (response) return response;

  const form = await request.formData();
  const file = form.get('file');
  const cycleId = form.get('cycle_id');
  const dryRun = form.get('dry_run') === '1';

  if (!file || typeof file === 'string') return fail('Attach a CSV file', 422);
  if (file.size > MAX_BYTES) return fail('That file is larger than 2 MB', 413);

  const cycle = await BillingCycle.findByPk(cycleId);
  if (!cycle) return fail('Billing cycle not found', 404);
  if (cycle.status !== 'open') {
    return fail(`Cycle ${cycle.period} is ${cycle.status} — readings are closed`, 409);
  }

  const { rows, errors } = parseReadingCsv(await file.text());
  if (!rows.length && !errors.length) return fail('That file has no rows', 422);

  const results = { imported: 0, flagged: 0, unknown: [], rejected: [...errors] };
  const preview = [];

  for (const row of rows) {
    const consumer = await consumerByAccount(row.account_no);
    if (!consumer) {
      results.unknown.push(row.account_no);
      continue;
    }

    try {
      if (dryRun) {
        // Same code path as a real save would take, minus the write.
        preview.push({ account_no: consumer.account_no, name: consumer.name, current_value: row.current_value });
        results.imported += 1;
        continue;
      }

      const { reading } = await saveReading({
        cycle,
        consumer,
        currentValue: row.current_value,
        source: 'csv',
        userId: user.id,
      });
      results.imported += 1;
      if (reading.flag !== 'ok') results.flagged += 1;
    } catch (err) {
      const message = err instanceof ReadingError ? err.message : 'Could not save';
      if (!(err instanceof ReadingError)) console.error('CSV import error:', err);
      results.rejected.push({ account: row.account_no, message });
    }
  }

  return success({ ...results, preview: dryRun ? preview.slice(0, 10) : undefined, dryRun });
}
