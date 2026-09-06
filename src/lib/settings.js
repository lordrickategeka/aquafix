import { QueryTypes } from 'sequelize';
import sequelize from '@/lib/db';

/* Organisation identity and bill wording. Read on most pages, written rarely,
   so the row set is cached in the module and dropped whenever it changes. */

export const SETTING_FIELDS = [
  {
    key: 'organisation_name',
    label: 'Organisation name',
    hint: 'Shown in the sidebar, on the login screen and at the top of a bill',
  },
  {
    key: 'organisation_initials',
    label: 'Logo initials',
    hint: 'One or two letters for the square mark',
  },
  { key: 'tagline', label: 'Tagline', hint: 'The small line under the name' },
  { key: 'bill_title', label: 'Bill heading', hint: 'The banner across the top of a printed bill' },
  { key: 'pay_phone', label: 'Mobile money number', hint: 'Printed on every bill' },
  {
    key: 'bill_footer',
    label: 'Bill footer',
    hint: 'Payment instructions. One line each.',
    multiline: true,
  },
];

export const SETTING_DEFAULTS = {
  organisation_name: 'Kuwe Foundation',
  organisation_initials: 'KW',
  tagline: 'Water & Billing',
  bill_title: 'WATER BILL',
  pay_phone: '',
  bill_footer: '',
};

let cache = null;

export async function getSettings() {
  if (cache) return cache;

  let rows = [];
  try {
    rows = await sequelize.query('SELECT `key`, value FROM settings', {
      type: QueryTypes.SELECT,
    });
  } catch {
    // Before the migration runs — fall back rather than break every page.
    return { ...SETTING_DEFAULTS };
  }

  const values = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    if (row.value !== null && row.value !== undefined) values[row.key] = row.value;
  }
  cache = values;
  return values;
}

export async function updateSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (!SETTING_FIELDS.some((field) => field.key === key)) continue;
    await sequelize.query(
      'INSERT INTO settings (`key`, value, updated_at) VALUES (?, ?, NOW()) ' +
        'ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
      { replacements: [key, String(value ?? '')] },
    );
  }
  cache = null;
  return getSettings();
}
