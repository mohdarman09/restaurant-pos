import { Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { comparePassword, hashPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { asyncHandler } from '../utils/asyncHandler';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** POST /api/auth/login */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active,
            u.restaurant_id, u.outlet_id, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1 AND u.deleted_at IS NULL`,
    [email]
  );
  const user = rows[0];

  if (!user || !user.is_active) {
    await pool.query(
      `INSERT INTO login_history (user_id, ip_address, user_agent, status)
       VALUES (NULL, $1, $2, 'failed')`,
      [req.ip, req.headers['user-agent']]
    ).catch(() => undefined); // user unknown; best-effort log
    throw ApiError.unauthorized('Invalid email or password');
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    await pool.query(
      `INSERT INTO login_history (user_id, ip_address, user_agent, status) VALUES ($1, $2, $3, 'failed')`,
      [user.id, req.ip, req.headers['user-agent']]
    );
    throw ApiError.unauthorized('Invalid email or password');
  }

  const accessToken = signAccessToken({
    userId: user.id,
    restaurantId: user.restaurant_id,
    outletId: user.outlet_id,
    role: user.role,
  });
  const refreshToken = signRefreshToken(user.id);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, now() + interval '7 days', $3, $4)`,
    [user.id, hashToken(refreshToken), req.ip, req.headers['user-agent']]
  );
  await pool.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);
  await pool.query(
    `INSERT INTO login_history (user_id, ip_address, user_agent, status) VALUES ($1, $2, $3, 'success')`,
    [user.id, req.ip, req.headers['user-agent']]
  );

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurant_id,
        outletId: user.outlet_id,
      },
    },
  });
});

/** POST /api/auth/refresh */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const { rows } = await pool.query(
    `SELECT * FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > now()`,
    [decoded.userId, tokenHash]
  );
  if (rows.length === 0) throw ApiError.unauthorized('Refresh token not recognized or revoked');

  const { rows: userRows } = await pool.query(
    `SELECT u.id, u.restaurant_id, u.outlet_id, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [decoded.userId]
  );
  const user = userRows[0];
  if (!user) throw ApiError.unauthorized('User no longer exists');

  const accessToken = signAccessToken({
    userId: user.id,
    restaurantId: user.restaurant_id,
    outletId: user.outlet_id,
    role: user.role,
  });

  res.json({ success: true, data: { accessToken } });
});

/** POST /api/auth/logout */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`,
      [hashToken(refreshToken)]
    );
  }
  res.json({ success: true, message: 'Logged out' });
});

/** POST /api/auth/change-password (authenticated) */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.auth!.userId;

  const { rows } = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  const user = rows[0];
  if (!user) throw ApiError.notFound('User not found');

  const valid = await comparePassword(currentPassword, user.password_hash);
  if (!valid) throw ApiError.badRequest('Current password is incorrect');

  const newHash = await hashPassword(newPassword);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, userId]);

  res.json({ success: true, message: 'Password changed successfully' });
});

/** POST /api/auth/forgot-password */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const { rows } = await pool.query(`SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`, [email]);
  const user = rows[0];

  // Always respond the same way whether or not the email exists (avoid user enumeration)
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '1 hour')`,
      [user.id, hashToken(rawToken)]
    );
    // In production: send `rawToken` via email/SMS provider — never log/return it.
  }

  res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
});

/** POST /api/auth/reset-password */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  const tokenHash = hashToken(token);

  const { rows } = await pool.query(
    `SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  const resetRow = rows[0];
  if (!resetRow) throw ApiError.badRequest('Reset token is invalid or expired');

  const newHash = await hashPassword(newPassword);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, resetRow.user_id]);
  await pool.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [resetRow.id]);

  res.json({ success: true, message: 'Password has been reset. You can now log in.' });
});

/** GET /api/auth/me */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, r.name AS role,
            u.restaurant_id, u.outlet_id
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [req.auth!.userId]
  );
  res.json({ success: true, data: rows[0] });
});
