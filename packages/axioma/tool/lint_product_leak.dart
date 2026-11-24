import 'dart:io';
import 'package:axioma/src/analysis/product_leak_linter.dart';

void main(List<String> args) async {
  final bool enforce = args.contains('--enforce');
  final List<String> paths = args
      .where((String a) => !a.startsWith('--'))
      .toList();
  final String targetPath = paths.isNotEmpty ? paths.first : 'lib';

  final Directory targetDir = Directory(targetPath);
  final File targetFile = File(targetPath);

  final ProductLeakLinter linter = const ProductLeakLinter();
  List<ProductLeakMatch> matches = <ProductLeakMatch>[];

  print(
    '=== [PRODUCT LEAK LINTER] Escaneando: $targetPath (Modo: ${enforce ? "ENFORCE" : "WARN-ONLY"}) ===',
  );

  if (await targetFile.exists()) {
    matches = await linter.lintFile(targetFile, enforce: false);
  } else if (await targetDir.exists()) {
    matches = await linter.lintDirectory(
      targetDir,
      enforce: false,
      excludePaths: <String>[
        '.dart_tool',
        '.git',
        'build',
        'src/analysis',
        'lib/src/analysis',
      ],
    );
  } else {
    print('[ERROR] La ruta objetivo "$targetPath" no existe.');
    exit(1);
  }

  if (matches.isEmpty) {
    print(
      '\x1B[32m[OK] Cero fugas de producto detectadas en $targetPath.\x1B[0m',
    );
    exit(0);
  }

  print(
    '\x1B[33m[WARN] Se encontraron ${matches.length} incidencias de términos satelitales:\x1B[0m',
  );
  for (final ProductLeakMatch match in matches) {
    print('  - ${match.toString()}');
  }

  if (enforce) {
    print(
      '\x1B[31m[FAIL] Fallo forzado por directiva --enforce. Limpie los términos satélite.\x1B[0m',
    );
    exit(1);
  } else {
    print(
      '\x1B[36m[WARN-ONLY] Modo diagnóstico completado. No se interrumpe el flujo.\x1B[0m',
    );
    exit(0);
  }
}
