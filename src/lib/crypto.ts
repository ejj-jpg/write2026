export async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildStudentKey(year: number, grade: number, classNum: number, studentNum: number): string {
  return `${year}-${grade}-${classNum}-${studentNum}`;
}

export function buildClassId(year: number, grade: number, classNum: number): string {
  return `${year}-${grade}-${classNum}`;
}

export function formatStudentName(name: string, studentNum: number, displayMode: 'full' | 'masked' | 'numOnly' = 'full'): string {
  if (displayMode === 'numOnly') {
    return `${studentNum}번 학생`;
  }
  if (displayMode === 'masked' && name.length >= 2) {
    if (name.length === 2) {
      return `${name[0]}*`;
    }
    return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`;
  }
  return name;
}
