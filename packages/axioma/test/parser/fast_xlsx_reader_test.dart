import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

Uint8List createValidXlsxArchive({
  required List<String> sharedStrings,
  required List<List<dynamic>> rows,
}) {
  final Archive archive = Archive();

  // 1. sharedStrings.xml
  final StringBuffer sstBuffer = StringBuffer(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">',
  );
  for (final String s in sharedStrings) {
    sstBuffer.write('<si><t>$s</t></si>');
  }
  sstBuffer.write('</sst>');
  final List<int> sstBytes = utf8.encode(sstBuffer.toString());
  archive.addFile(
    ArchiveFile('xl/sharedStrings.xml', sstBytes.length, sstBytes),
  );

  // 2. workbook.xml.rels
  const String relsContent =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      '</Relationships>';
  final List<int> relsBytes = utf8.encode(relsContent);
  archive.addFile(
    ArchiveFile('xl/_rels/workbook.xml.rels', relsBytes.length, relsBytes),
  );

  // 3. workbook.xml
  const String wbContent =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      '<sheets>'
      '<sheet name="Inventario" sheetId="1" r:id="rId1"/>'
      '</sheets>'
      '</workbook>';
  final List<int> wbBytes = utf8.encode(wbContent);
  archive.addFile(ArchiveFile('xl/workbook.xml', wbBytes.length, wbBytes));

  // 4. sheet1.xml
  final StringBuffer sheetBuffer = StringBuffer(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<sheetData>',
  );
  for (int r = 0; r < rows.length; r++) {
    sheetBuffer.write('<row r="${r + 1}">');
    final List<dynamic> row = rows[r];
    for (int c = 0; c < row.length; c++) {
      final dynamic val = row[c];
      final String colLetter = String.fromCharCode(65 + c);
      final String cellRef = '$colLetter${r + 1}';
      if (val is int || val is double) {
        sheetBuffer.write('<c r="$cellRef"><v>$val</v></c>');
      } else if (val is String) {
        final int sstIndex = sharedStrings.indexOf(val);
        if (sstIndex >= 0) {
          sheetBuffer.write('<c r="$cellRef" t="s"><v>$sstIndex</v></c>');
        } else {
          sheetBuffer.write(
            '<c r="$cellRef" t="inlineStr"><is><t>$val</t></is></c>',
          );
        }
      }
    }
    sheetBuffer.write('</row>');
  }
  sheetBuffer.write('</sheetData></worksheet>');
  final List<int> sheetBytes = utf8.encode(sheetBuffer.toString());
  archive.addFile(
    ArchiveFile('xl/worksheets/sheet1.xml', sheetBytes.length, sheetBytes),
  );

  final List<int>? encoded = ZipEncoder().encode(archive);
  return Uint8List.fromList(encoded!);
}

void main() {
  group('FastXlsxReader - Happy Path (§22, §39, §54)', () {
    test('decodifica hojas, shared strings y celdas numéricas e inline', () {
      final Uint8List validXlsx = createValidXlsxArchive(
        sharedStrings: <String>['Pastillas de Freno', 'Brembo'],
        rows: <List<dynamic>>[
          <dynamic>['SKU-001', 'Pastillas de Freno', 45.5],
          <dynamic>['SKU-002', 'Brembo', 120],
        ],
      );

      final List<FastSheet> sheets = FastXlsxReader.readSheets(validXlsx);

      expect(sheets.length, equals(1));
      final FastSheet sheet = sheets.first;
      expect(sheet.name, equals('Inventario'));
      expect(sheet.rowCount, equals(2));

      expect(sheet.rows[0][0], equals('SKU-001'));
      expect(sheet.rows[0][1], equals('Pastillas de Freno'));
      expect(sheet.rows[0][2], equals('45.5'));

      expect(sheet.rows[1][0], equals('SKU-002'));
      expect(sheet.rows[1][1], equals('Brembo'));
      expect(sheet.rows[1][2], equals('120'));
    });

    test(
      'lee correctamente archivo guardado en disco mediante readFromFile',
      () {
        final Directory tempDir = Directory.systemTemp.createTempSync(
          'fast_xlsx_test_',
        );
        try {
          final File xlsxFile = File('${tempDir.path}/catalogo.xlsx');
          final Uint8List validXlsx = createValidXlsxArchive(
            sharedStrings: <String>['Bujía Iridium'],
            rows: <List<dynamic>>[
              <dynamic>['NGK-1', 'Bujía Iridium', 12.0],
            ],
          );
          xlsxFile.writeAsBytesSync(validXlsx);

          final List<FastSheet> sheets = FastXlsxReader.readFromFile(xlsxFile);
          expect(sheets.length, equals(1));
          expect(sheets.first.name, equals('Inventario'));
          expect(sheets.first.rows.first[1], equals('Bujía Iridium'));
        } finally {
          if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
        }
      },
    );
  });

  group('FastXlsxReader - Sad Paths (§4, §6, §54)', () {
    test('arroja FastXlsxMalformedException con buffer vacío', () {
      expect(
        () => FastXlsxReader.readSheets(Uint8List(0)),
        throwsA(isA<FastXlsxMalformedException>()),
      );
    });

    test('arroja FastXlsxMalformedException ante bytes binarios corruptos', () {
      final Uint8List corruptBytes = Uint8List.fromList(<int>[
        0x50,
        0x4B,
        0x03,
        0x04,
        0x00,
        0xFF,
        0xEE,
        0xDD,
      ]);
      expect(
        () => FastXlsxReader.readSheets(corruptBytes),
        throwsA(isA<FastXlsxMalformedException>()),
      );
    });

    test(
      'arroja FastXlsxMalformedException si falta sharedStrings con strictSharedStrings',
      () {
        final Archive archive = Archive();
        const String sheetContent =
            '<?xml version="1.0"?><worksheet><sheetData><row><c><v>1</v></c></row></sheetData></worksheet>';
        final List<int> bytes = utf8.encode(sheetContent);
        archive.addFile(
          ArchiveFile('xl/worksheets/sheet1.xml', bytes.length, bytes),
        );
        final List<int>? encoded = ZipEncoder().encode(archive);
        final Uint8List xlsxNoSst = Uint8List.fromList(encoded!);

        expect(
          () => FastXlsxReader.readSheets(xlsxNoSst, strictSharedStrings: true),
          throwsA(isA<FastXlsxMalformedException>()),
        );
      },
    );

    test(
      'arroja FastXlsxMalformedException ante XML malformado en la hoja',
      () {
        final Archive archive = Archive();
        const String badXml = '<worksheet><sheetData><row><c unclosed tag';
        final List<int> bytes = utf8.encode(badXml);
        archive.addFile(
          ArchiveFile('xl/worksheets/sheet1.xml', bytes.length, bytes),
        );
        final List<int>? encoded = ZipEncoder().encode(archive);
        final Uint8List badXmlXlsx = Uint8List.fromList(encoded!);

        expect(
          () => FastXlsxReader.readSheets(badXmlXlsx),
          throwsA(isA<FastXlsxMalformedException>()),
        );
      },
    );

    test(
      'arroja FastXlsxMalformedException cuando archivo en disco no existe',
      () {
        final File nonExistent = File('/tmp/non_existent_file_99999.xlsx');
        expect(
          () => FastXlsxReader.readFromFile(nonExistent),
          throwsA(isA<FastXlsxMalformedException>()),
        );
      },
    );
  });
}
