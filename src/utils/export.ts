import type { EditalItem, EditaisJsonPayload } from '../types/edital';

export function formatEditaisJson(payload: EditaisJsonPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function downloadJsonFile(payload: EditaisJsonPayload, filename?: string): void {
  const jsonString = formatEditaisJson(payload);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `editais-publicos-${payload.data_consulta}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string): string {
  const safe = (value ?? '').replace(/\r?\n/g, ' ').trim();
  // Neutralize spreadsheet formula prefixes
  const neutralized = /^[=+\-@\t\r]/.test(safe) ? `'${safe}` : safe;
  if (neutralized.includes(';') || neutralized.includes('"') || neutralized.includes(',')) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export function downloadCsvFile(editais: EditalItem[], dateLabel: string): void {
  const headers = [
    'ID',
    'Órgão Emissor',
    'Título',
    'Resumo do Objeto',
    'Elegibilidade',
    'Valor Total ou Teto',
    'Prazo de Submissão',
    'Fonte de Recurso',
    'URL Oficial',
  ];

  const rows = editais.map((item) =>
    [
      item.id,
      item.orgao_emissor,
      item.titulo,
      item.resumo_objeto,
      item.elegibilidade,
      item.valor_total_ou_teto,
      item.prazo_submissao,
      item.fonte_recurso,
      item.url_oficial,
    ]
      .map(escapeCsvCell)
      .join(';'),
  );

  // UTF-8 BOM + semicolon separator for Brazilian Excel compatibility
  const csvContent = `\uFEFF${headers.join(';')}\n${rows.join('\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `editais-publicos-${dateLabel}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
