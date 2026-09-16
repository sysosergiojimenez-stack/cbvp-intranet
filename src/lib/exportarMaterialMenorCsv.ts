// Exporta el inventario de Material Menor a un .csv que Excel abre
// directamente. Se usa punto y coma como separador porque en Excel con
// configuracion regional en espanol la coma es el separador decimal, y
// separar por coma hace que todo el contenido caiga en una sola columna.
//
// Nota: se eligio CSV en vez de generar un .xlsx real porque la libreria
// xlsx (SheetJS) publicada en npm tiene dos vulnerabilidades altas sin
// parche disponible en el registro publico; para un caso de uso de solo
// escritura como este, CSV cubre la necesidad sin agregar esa dependencia.
export interface FilaInventarioExport {
  categoria: string;
  item: string;
  marca: string;
  modelo: string;
  cantidad: string;
  precioUnitario: string;
  ubicacion: string;
  tipo: string;
  serialCodigo: string;
  especificaciones: string;
  observaciones: string;
  fecha: string;
}

function csvEscape(valor: string): string {
  const v = valor ?? '';
  if (/[";\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function exportarInventarioCsv(filas: FilaInventarioExport[]) {
  const encabezados = [
    'Categoria', 'Item', 'Marca', 'Modelo', 'Cantidad', 'Precio Unitario',
    'Ubicacion', 'Tipo', 'Serial/Codigo', 'Especificaciones', 'Observaciones', 'Fecha',
  ];
  const lineas = [
    encabezados.join(';'),
    ...filas.map((f) => [
      f.categoria, f.item, f.marca, f.modelo, f.cantidad, f.precioUnitario,
      f.ubicacion, f.tipo, f.serialCodigo, f.especificaciones, f.observaciones, f.fecha,
    ].map(csvEscape).join(';')),
  ];

  const BOM = '﻿'; // para que Excel detecte UTF-8
  const contenido = BOM + lineas.join('\r\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Inventario_Material_Menor_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
