import { enqueue } from '@/lib/queue';

export default async function sendWelcomeEmail({ email }) {
  await enqueue('send-welcome-email', { email });
}
