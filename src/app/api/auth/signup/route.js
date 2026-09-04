import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { User } from '@/models';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';
import { buildFlashCookie } from '@/lib/flash';
import { emit, EVENTS } from '@/lib/events';

export async function POST(request) {
  try {
    const body = await request.json();
    const { valid, errors } = validate(body, {
      email: 'required|email',
      password: 'required|min:8',
    });
    if (!valid) return fail('Validation failed', 422, errors);

    const { email, password } = body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return fail('User already exists', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword });

    await emit(EVENTS.USER_REGISTERED, { id: user.id, email: user.email });

    const cookieStore = await cookies();
    cookieStore.set(buildFlashCookie('success', 'Account created.'));

    return success({ message: 'User registered successfully' }, 201);
  } catch (err) {
    console.error('Signup error:', err);
    return fail('Internal server error', 500);
  }
}
