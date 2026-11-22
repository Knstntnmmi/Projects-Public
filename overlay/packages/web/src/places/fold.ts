// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/** Lower-cases, strips accents and maps the few letters that do not decompose, so that "München" and "munchen" compare equal. */
const EXTRA: Record<string, string> = { ß: 'ss', ø: 'o', æ: 'ae', œ: 'oe', đ: 'd', ł: 'l', ı: 'i', ð: 'd', þ: 'th' };

export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ßøæœđłıðþ]/g, (c) => EXTRA[c] ?? c)
    .replace(/[ʻʼ’]/g, "'")
    .trim();
}
