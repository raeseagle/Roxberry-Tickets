import Papa from 'papaparse';

export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  return Papa.unparse({ fields: columns, data: rows.map((r) => columns.map((c) => r[c] ?? '')) });
}

export async function readCsvFile(file: File | null) {
  if (!file || file.size === 0) throw new Error('Choose a CSV file to import.');
  if (file.size > 2_000_000) throw new Error('That file is too large (2 MB max).');
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });
  return parsed.data;
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export function truthy(v: string | undefined, fallback = true) {
  if (v == null || v.trim() === '') return fallback;
  return ['yes', 'y', 'true', '1', 'published', 'active'].includes(v.trim().toLowerCase());
}
