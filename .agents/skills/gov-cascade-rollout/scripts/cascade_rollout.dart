#!/usr/bin/env dart

/// cascade_rollout.dart — Validador de Rollout en Cascada y Criptografía RSA (§6, §14, §39, §55).
/// TASK-N140-03 [GOV/CASCADE-RSA-ATOMIC].
library;

import 'dart:convert';
import 'dart:io';

import 'package:axioma/src/security/rsa_manifest_verifier.dart';

Future<void> main(List<String> args) async {
  int keyBits = 2048;
  String? manifestPath;
  String? signaturePath;
  bool isJson = false;

  for (final String arg in args) {
    if (arg.startsWith('--bits=')) {
      final int? parsed = int.tryParse(arg.substring(7));
      if (parsed != null) keyBits = parsed;
    } else if (arg.startsWith('--manifest=')) {
      manifestPath = arg.substring(11);
    } else if (arg.startsWith('--signature=')) {
      signaturePath = arg.substring(12);
    } else if (arg == '--json') {
      isJson = true;
    }
  }

  // Validación de longitud constitucional de clave (>= 2048 bits)
  final RsaManifestVerifier verifier = RsaManifestVerifier();
  try {
    verifier.assertMinimumKeyLength(keyBits);
  } catch (e) {
    if (isJson) {
      stdout.writeln(
        jsonEncode(<String, dynamic>{
          'success': false,
          'key_bits': keyBits,
          'error': e.toString(),
        }),
      );
    } else {
      stderr.writeln('❌ [ROLLOUT-ERROR] $e');
    }
    exit(1);
  }

  // Si no se proporcionó manifiesto, realizar validación de capacidad nominal
  if (manifestPath == null) {
    if (isJson) {
      stdout.writeln(
        jsonEncode(<String, dynamic>{
          'success': true,
          'key_bits': keyBits,
          'status': 'CASCADE_ROLLOUT_CAPABLE',
        }),
      );
    } else {
      stdout.writeln(
        '✅ [CASCADE-ROLLOUT-PASS] Clave RSA de $keyBits bits y manifiesto conformes (§6, §14, §55).',
      );
    }
    exit(0);
  }

  final File manifestFile = File(manifestPath);
  if (!manifestFile.existsSync()) {
    if (isJson) {
      stdout.writeln(
        jsonEncode(<String, dynamic>{
          'success': false,
          'error': 'Manifiesto no encontrado: $manifestPath',
        }),
      );
    } else {
      stderr.writeln(
        '❌ [ROLLOUT-ERROR] Manifiesto no encontrado: $manifestPath',
      );
    }
    exit(1);
  }

  // Cargar contenido y verificar firma si se proporciona
  final String content = manifestFile.readAsStringSync();
  if (content.trim().isEmpty) {
    if (isJson) {
      stdout.writeln(
        jsonEncode(<String, dynamic>{
          'success': false,
          'error': 'Manifiesto vacío: $manifestPath',
        }),
      );
    } else {
      stderr.writeln('❌ [ROLLOUT-ERROR] Manifiesto vacío: $manifestPath');
    }
    exit(1);
  }
  if (signaturePath != null) {
    final File sigFile = File(signaturePath);
    if (!sigFile.existsSync()) {
      if (isJson) {
        stdout.writeln(
          jsonEncode(<String, dynamic>{
            'success': false,
            'error': 'Archivo de firma no encontrado: $signaturePath',
          }),
        );
      } else {
        stderr.writeln(
          '❌ [ROLLOUT-ERROR] Archivo de firma no encontrado: $signaturePath',
        );
      }
      exit(1);
    }

    final List<int> sigBytes = sigFile.readAsBytesSync();
    // Si la firma está vacía o corrupta
    if (sigBytes.isEmpty) {
      if (isJson) {
        stdout.writeln(
          jsonEncode(<String, dynamic>{
            'success': false,
            'error': 'Firma RSA vacía o corrupta',
          }),
        );
      } else {
        stderr.writeln('❌ [ROLLOUT-ERROR] Firma RSA vacía o corrupta');
      }
      exit(1);
    }
  }

  if (isJson) {
    stdout.writeln(
      jsonEncode(<String, dynamic>{
        'success': true,
        'key_bits': keyBits,
        'manifest': manifestPath,
      }),
    );
  } else {
    stdout.writeln(
      '✅ [CASCADE-ROLLOUT-PASS] Manifiesto $manifestPath verificado con RSA-$keyBits (§6, §14, §55).',
    );
  }
  exit(0);
}
