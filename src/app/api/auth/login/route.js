import bcrypt from 'bcryptjs';
import { User } from '@/models';
import { validate } from '@/lib/validate';
import { success, fail } from '@/lib/api-response';
import { signToken, setSessionCookie } from '@/lib/auth';
import { emit, EVENTS } from '@/lib/events';

export async function POST(request) {
  try {
    const body = await request.json();
    const { valid, errors } = validate(body, {
      email: 'required|email',
      password: 'required',
    });
    if (!valid) return fail('Validation failed', 422, errors);
// here
    const { email, password } = body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return fail('Invalid email or password', 401);
    }

    const token = signToken({ id: user.id, email: user.email });
    await setSessionCookie(token);

    await emit(EVENTS.USER_LOGGED_IN, { id: user.id, email: user.email });

    return success({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    return fail('Internal server error', 500);
  }
}
