/// tools/takeover_gate.dart — Compuerta Física Anti-Rebote y Delegación de Takeover (§50).
import 'dart:io';
import 'package:axioma/src/governance/takeover_rebound_gate.dart';

void main(List<String> args) async {
  String? convId;
  for (int i = 0; i < args.length; i++) {
    final String arg = args[i];
    if (arg.startsWith('--conversation-id=')) {
      convId = arg.substring('--conversation-id='.length).trim();
    } else if (arg == '-c' && i + 1 < args.length) {
      convId = args[i + 1].trim();
    }
  }

  final String rootDir = Directory.current.path;
  if (convId != null && convId.isNotEmpty) {
    final TakeoverReboundGate gate = TakeoverReboundGate(rootPath: rootDir);
    try {
      gate.validateDiskState(convId, throwOnError: true);
    } on TakeoverReboundException catch (e) {
      stderr.writeln(e.message);
      exit(1);
    } on SealedSessionException catch (e) {
      stderr.writeln(e.message);
      exit(1);
    } catch (e) {
      stderr.writeln('⚠️ [TAKEOVER-GATE] Error en validación: $e');
      exit(1);
    }
  }

  // Despacho canónico a bin/logix.native takeover
  final String nativeBin = '$rootDir/bin/logix.native';
  if (File(nativeBin).existsSync()) {
    final Process process = await Process.start(nativeBin, <String>[
      'takeover',
      ...args,
    ], mode: ProcessStartMode.inheritStdio);
    final int code = await process.exitCode;
    exit(code);
  } else {
    stderr.writeln('❌ Error: Binario nativo logix no encontrado en $nativeBin');
    exit(1);
  }
}
