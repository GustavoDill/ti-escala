import crypto from 'node:crypto';

/**
 * CLI utility to generate SHA-512 password hashes or random credentials
 * for `public.escala_auth` in Supabase.
 *
 * Usage:
 *   npm run hash-password -- <plain-password>
 *   npm run hash-password                       (generates fresh random passwords for administrator & system)
 */
function sha512Hex(password: string): string {
  return crypto.createHash('sha512').update(password, 'utf8').digest('hex');
}

function generateRandomPassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

const argPassword = process.argv[2];

if (argPassword) {
  const hash = sha512Hex(argPassword);
  console.log('\n=== SHA-512 Password Hash ===');
  console.log(`Plaintext : ${argPassword}`);
  console.log(`SHA-512   : ${hash}\n`);
  console.log('SQL Snippet:');
  console.log(
    `UPDATE public.escala_auth SET password_hash = '${hash}', updated_at = NOW() WHERE role = 'administrator';\n`
  );
} else {
  const adminPass = generateRandomPassword(16);
  const systemPass = generateRandomPassword(16);
  const adminHash = sha512Hex(adminPass);
  const systemHash = sha512Hex(systemPass);

  console.log('\n=== Generated Initial Credentials (Save These Securely) ===');
  console.log(`[administrator] Password : ${adminPass}`);
  console.log(`[administrator] SHA-512  : ${adminHash}\n`);
  console.log(`[system]        Password : ${systemPass}`);
  console.log(`[system]        SHA-512  : ${systemHash}\n`);
  console.log('=== SQL to run in Supabase SQL Editor ===\n');
  console.log(`INSERT INTO public.escala_auth (role, password_hash, description)
VALUES
  ('administrator', '${adminHash}', 'Administrator role for Boss / Escala Manager'),
  ('system',        '${systemHash}', 'System role for Developer / Maintainer')
ON CONFLICT (role) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    updated_at = NOW();\n`);
}

