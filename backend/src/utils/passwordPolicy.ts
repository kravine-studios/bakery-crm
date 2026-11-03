/**
 * Password policy enforcement.
 * - Minimum 10 characters
 * - Reject the 100 most common passwords
 * - Strength score via zxcvbn (score 0-4)
 */

import zxcvbn from 'zxcvbn';

/**
 * A curated list of the 100 most common passwords.
 * Source: top entries from SecLists / haveibeenpwned common passwords.
 * Stored lowercase for case-insensitive comparison.
 */
const COMMON_PASSWORDS = new Set([
  'password','password1','password123','123456','12345678','12345','1234567','1234567890',
  'qwerty','abc123','iloveyou','admin','letmein','monkey','1234','sunshine','master',
  'welcome','shadow','superman','michael','jesus','ninja','dragon','princess','soccer',
  'baseball','football','hockey','soccer123','batman','trustno1','starwars','hello',
  'charlie','donald','password2','1q2w3e4r','qwerty123','iloveyou1','hunter2','letmein1',
  'administrator','test','login','pass','root','toor','abc','pass123','user',
  'admin123','passw0rd','p@ssw0rd','p@ssword','pass1234','test123','guest','default',
  'changeme','changeit','mustang','access','flower','baseball1','football1','hockey1',
  'liverpool','chelsea','arsenal','qwertyuiop','azerty','zxcvbnm','1111111','11111111',
  '000000','999999','696969','121212','112233','123123','123321','654321','666666',
  '777777','987654321','pass@123','p@ss123','p@$$word','pa$$word','pa$$w0rd','$ecret',
  'secret123','maga2020','trump2020','1234qwer','q1w2e3r4','admin@123','test@123',
  'iloveyou2','babygirl','loveme','pass@1234','welcome1','123abc','pass@word',
]);

export interface PasswordCheckResult {
  ok: boolean;
  errors: string[];
  score: number; // 0-4 (zxcvbn)
}

export function checkPassword(password: string): PasswordCheckResult {
  const errors: string[] = [];

  if (password.length < 10) {
    errors.push('Password must be at least 10 characters.');
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a more unique password.');
  }

  const result = zxcvbn(password);
  const score = result.score; // 0 = very weak, 4 = very strong

  if (score < 2 && errors.length === 0) {
    // zxcvbn gives feedback
    const suggestion = result.feedback?.suggestions?.[0] ?? '';
    errors.push(`Password is too weak. ${suggestion}`.trim());
  }

  return { ok: errors.length === 0, errors, score };
}

/**
 * Generate a cryptographically random strong password.
 * 16 chars: upper, lower, digits, symbols.
 */
export function generateStrongPassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const symbols = '@#$%^&*!?';
  const all     = upper + lower + digits + symbols;

  const crypto = require('crypto') as typeof import('crypto');

  // Guarantee at least one from each class
  const parts = [
    upper  [crypto.randomInt(upper.length)],
    lower  [crypto.randomInt(lower.length)],
    digits [crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];

  // Fill to 16 characters
  for (let i = 4; i < 16; i++) {
    parts.push(all[crypto.randomInt(all.length)]);
  }

  // Shuffle
  for (let i = parts.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }

  return parts.join('');
}
