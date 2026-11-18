/// fast_xlsx_reader.dart — Motor de Ingesta Tabular Pure Dart de Alto Rendimiento (§22, §39, §54).
///
/// Shared Kernel agnóstico de UI. Diseñado para ingestas masivas de catálogos y streaming
/// tabular con mínimo consumo de RAM y protección estricta contra corrupciones de archivo.
library;

import 'dart:convert';
import 'dart:io' as io;
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

/// Excepción tipada para archivos XLSX corruptos, malformados o con XML inválido (§6, §54).
class FastXlsxMalformedException implements Exception {
  final String message;
  final dynamic cause;

  const FastXlsxMalformedException(this.message, {this.cause});

  @override
  String toString() {
    if (cause != null) {
      return 'FastXlsxMalformedException: $message (causa: $cause)';
    }
    return 'FastXlsxMalformedException: $message';
  }
}

/// Representa una hoja individual procesada con su nombre y filas.
class FastSheet {
  final String name;
  final List<List<dynamic>> rows;

  const FastSheet({required this.name, required this.rows});

  /// Retorna el conteo total de filas.
  int get rowCount => rows.length;

  /// Retorna true si la hoja no contiene filas.
  bool get isEmpty => rows.isEmpty;

  /// Retorna true si la hoja contiene al menos una fila.
  bool get isNotEmpty => rows.isNotEmpty;
}

/// Lector de alto rendimiento y bajo consumo de memoria para archivos Excel OpenXML (.xlsx).
class FastXlsxReader {
  /// Lee todas las hojas de un archivo XLSX a partir de sus bytes en memoria.
  ///
  /// - [bytes]: Contenido binario del archivo .xlsx.
  /// - [strictSharedStrings]: Si es true, exige la presencia de `xl/sharedStrings.xml`.
  static List<FastSheet> readSheets(
    Uint8List bytes, {
    bool strictSharedStrings = false,
  }) {
    if (bytes.isEmpty) {
      throw const FastXlsxMalformedException(
        'El buffer de bytes del archivo XLSX está vacío.',
      );
    }

    final Archive archive;
    try {
      archive = ZipDecoder().decodeBytes(bytes);
    } catch (e) {
      throw FastXlsxMalformedException(
        'No fue posible decodificar el contenedor ZIP del archivo XLSX.',
        cause: e,
      );
    }

    // 1. Parsear shared strings si existen o validar si son requeridas
    final List<String> sharedStrings = <String>[];
    final ArchiveFile? sstFile = archive.findFile('xl/sharedStrings.xml');

    if (sstFile != null) {
      try {
        final String sstContent = utf8.decode(
          sstFile.content as List<int>,
          allowMalformed: false,
        );
        final XmlDocument sstDoc = XmlDocument.parse(sstContent);
        for (final XmlElement si in sstDoc.findAllElements('si')) {
          final Iterable<XmlElement> tNodes = si.findAllElements('t');
          final String str = tNodes.map((XmlElement t) => t.innerText).join();
          sharedStrings.add(str);
        }
      } catch (e) {
        throw FastXlsxMalformedException(
          'Error al parsear el catálogo de cadenas compartidas xl/sharedStrings.xml.',
          cause: e,
        );
      }
    } else if (strictSharedStrings) {
      throw const FastXlsxMalformedException(
        'El archivo XLSX carece del descriptor requerido xl/sharedStrings.xml.',
      );
    }

    // 2. Mapear rId -> Target de worksheet mediante relationships
    final Map<String, String> relIdToTarget = <String, String>{};
    final ArchiveFile? relsFile = archive.findFile(
      'xl/_rels/workbook.xml.rels',
    );
    if (relsFile != null) {
      try {
        final String relsContent = utf8.decode(
          relsFile.content as List<int>,
          allowMalformed: true,
        );
        final XmlDocument relsDoc = XmlDocument.parse(relsContent);
        for (final XmlElement rel in relsDoc.findAllElements('Relationship')) {
          final String? id = rel.getAttribute('Id');
          final String? target = rel.getAttribute('Target');
          if (id != null && target != null) {
            final String normalized = target.startsWith('worksheets/')
                ? 'xl/$target'
                : (target.startsWith('/') ? target.substring(1) : 'xl/$target');
            relIdToTarget[id] = normalized;
          }
        }
      } catch (e) {
        throw FastXlsxMalformedException(
          'Error al parsear las relaciones de libro xl/_rels/workbook.xml.rels.',
          cause: e,
        );
      }
    }

    // 3. Parsear workbook para obtener nombres oficiales de las hojas
    final List<Map<String, String>> sheetEntries = <Map<String, String>>[];
    final ArchiveFile? wbFile = archive.findFile('xl/workbook.xml');
    if (wbFile != null) {
      try {
        final String wbContent = utf8.decode(
          wbFile.content as List<int>,
          allowMalformed: true,
        );
        final XmlDocument wbDoc = XmlDocument.parse(wbContent);
        for (final XmlElement sheet in wbDoc.findAllElements('sheet')) {
          final String name = sheet.getAttribute('name') ?? 'Hoja';
          final String? rId =
              sheet.getAttribute('r:id') ?? sheet.getAttribute('id');
          if (rId != null && relIdToTarget.containsKey(rId)) {
            sheetEntries.add(<String, String>{
              'name': name,
              'path': relIdToTarget[rId]!,
            });
          }
        }
      } catch (e) {
        throw FastXlsxMalformedException(
          'Error al parsear la estructura del libro xl/workbook.xml.',
          cause: e,
        );
      }
    }

    // Fallback si el workbook no declaró hojas o rels falló
    if (sheetEntries.isEmpty) {
      for (final ArchiveFile f in archive.files) {
        if (f.name.startsWith('xl/worksheets/sheet') &&
            f.name.endsWith('.xml')) {
          sheetEntries.add(<String, String>{
            'name': f.name
                .replaceAll('xl/worksheets/', '')
                .replaceAll('.xml', ''),
            'path': f.name,
          });
        }
      }
    }

    if (sheetEntries.isEmpty) {
      throw const FastXlsxMalformedException(
        'El archivo XLSX no contiene hojas de trabajo válidas en xl/worksheets/.',
      );
    }

    final List<FastSheet> results = <FastSheet>[];

    for (final Map<String, String> entry in sheetEntries) {
      final String sheetPath = entry['path']!;
      final String sheetName = entry['name']!;
      final ArchiveFile? sheetFile = archive.findFile(sheetPath);
      if (sheetFile == null) continue;

      final XmlDocument sheetDoc;
      try {
        final String sheetContent = utf8.decode(
          sheetFile.content as List<int>,
          allowMalformed: false,
        );
        sheetDoc = XmlDocument.parse(sheetContent);
      } catch (e) {
        throw FastXlsxMalformedException(
          'Error al parsear el XML de la hoja "$sheetName" en $sheetPath.',
          cause: e,
        );
      }

      final List<List<dynamic>> rowsList = <List<dynamic>>[];

      for (final XmlElement rowElem in sheetDoc.findAllElements('row')) {
        int maxColIndex = 0;
        final Map<int, dynamic> cellMap = <int, dynamic>{};

        for (final XmlElement c in rowElem.findAllElements('c')) {
          final String? r = c.getAttribute('r');
          final String? t = c.getAttribute('t');
          final XmlElement? vElem = c.findElements('v').firstOrNull;
          final XmlElement? isElem = c.findElements('is').firstOrNull;

          dynamic val;
          if (t == 's' && vElem != null) {
            final int? sIdx = int.tryParse(vElem.innerText);
            if (sIdx != null && sIdx >= 0 && sIdx < sharedStrings.length) {
              val = sharedStrings[sIdx];
            } else if (sstFile == null) {
              throw const FastXlsxMalformedException(
                'La celda referencia sharedStrings pero el archivo carece de xl/sharedStrings.xml.',
              );
            } else {
              val = vElem.innerText;
            }
          } else if (t == 'inlineStr' && isElem != null) {
            val = isElem
                .findAllElements('t')
                .map((XmlElement t) => t.innerText)
                .join();
          } else if (vElem != null) {
            val = vElem.innerText;
          }

          if (r != null) {
            final int colIdx = _colRefToIndex(r);
            cellMap[colIdx] = val;
            if (colIdx > maxColIndex) maxColIndex = colIdx;
          } else {
            final int nextIdx = cellMap.length;
            cellMap[nextIdx] = val;
            if (nextIdx > maxColIndex) maxColIndex = nextIdx;
          }
        }

        final List<dynamic> rowData = List<dynamic>.filled(
          maxColIndex + 1,
          null,
        );
        for (final MapEntry<int, dynamic> cellEntry in cellMap.entries) {
          rowData[cellEntry.key] = cellEntry.value;
        }
        rowsList.add(rowData);
      }

      results.add(FastSheet(name: sheetName, rows: rowsList));
    }

    return results;
  }

  /// Lee un archivo físico en disco.
  static List<FastSheet> readFromFile(
    io.File file, {
    bool strictSharedStrings = false,
  }) {
    if (!file.existsSync()) {
      throw FastXlsxMalformedException(
        'El archivo XLSX no existe físicamente en disco.',
        cause: file.path,
      );
    }
    final Uint8List bytes = file.readAsBytesSync();
    return readSheets(bytes, strictSharedStrings: strictSharedStrings);
  }

  static int _colRefToIndex(String cellRef) {
    int col = 0;
    for (int i = 0; i < cellRef.length; i++) {
      final int code = cellRef.codeUnitAt(i);
      if (code >= 65 && code <= 90) {
        col = col * 26 + (code - 64);
      } else {
        break;
      }
    }
    return col > 0 ? col - 1 : 0;
  }
}
