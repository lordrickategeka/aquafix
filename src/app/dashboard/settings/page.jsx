import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { userHasRole } from '@/lib/rbac';
import { getSettings, SETTING_FIELDS } from '@/lib/settings';
import SettingsForm from './_components/settings-form';

export default async function SettingsPage() {
  const session = await getSessionUser();
  if (!(await userHasRole(session.id, 'admin'))) redirect('/dashboard');

  const settings = await getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <SettingsForm fields={SETTING_FIELDS} values={settings} />
    </div>
  );
}
