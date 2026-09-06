// Оффлайн-ник Minecraft должен состоять из A-Za-z0-9_ (и без спецсимволов).
// Транслит кириллицы + замена всего недопустимого на '_'.

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const MAX_LENGTH = 16; // лимит длины ника Minecraft

export function sanitizeMinecraftUsername(raw: string): string {
  if (!raw) return 'Player';

  let out = '';
  for (const ch of raw.trim().toLowerCase()) {
    out += TRANSLIT[ch] ?? ch;
  }

  // Заменяем всё, что не A-Za-z0-9_ , на '_' и схлопываем повторы
  let result = '';
  let prevUnderscore = false;
  for (const ch of out) {
    const isAllowed = /[a-z0-9_]/.test(ch);
    if (isAllowed) {
      result += ch;
      prevUnderscore = false;
    } else if (!prevUnderscore) {
      result += '_';
      prevUnderscore = true;
    }
  }

  result = result.replace(/^_+|_+$/g, '') || 'Player';
  return result.slice(0, MAX_LENGTH);
}