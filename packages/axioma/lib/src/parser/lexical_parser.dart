/// LexicalParser — Motor de clasificación por anclas léxicas en memoria.
/// Desacoplado de sistema de archivos local.
class LexicalParser {
  final Map<RegExp, String> rules;

  LexicalParser({Map<RegExp, String>? customRules})
    : rules = customRules ?? defaultRules;

  static final Map<RegExp, String> defaultRules = <RegExp, String>{
    RegExp(r'\bAMORT(?:IGUADOR|IGUADORES)?\b|\bAMORT\b', caseSensitive: false):
        'AMORTIGUADOR',
    RegExp(r'\bBOMBA\b|\bBOMBAS\b|\bFLOTANTE\b', caseSensitive: false): 'BOMBA',
    RegExp(r'\bCORREA\b|\bCORREAS\b|\bKITS? TIEMPO\b', caseSensitive: false):
        'CORREA',
    RegExp(
      r'\bEMP(?:AQUE)?\b|\bEMPAQUETADURA\b|\bEMPAD\b',
      caseSensitive: false,
    ): 'EMPAQUE',
    RegExp(r'\bFILTRO\b|\bFILTROS\b', caseSensitive: false): 'FILTRO',
    RegExp(
      r'\bPASTILLA\b|\bPASTILLAS\b|\bDISCO\b|\bDISCOS\b|\bZAPATA\b',
      caseSensitive: false,
    ): 'FRENO',
    RegExp(
      r'\bMESETA\b|\bMESETAS\b|\bTIJERA\b|\bTIJERAS\b',
      caseSensitive: false,
    ): 'MESETA',
    RegExp(r'\bVALVULA\b|\bVALVULAS\b', caseSensitive: false): 'VALVULA',
    RegExp(
      r'\bRODAMIENTO\b|\bRODAMIENTOS\b|\bROLINERA\b|\bRODILLO\b',
      caseSensitive: false,
    ): 'RODAMIENTO',
    RegExp(r'\bESTOPERA\b|\bESTOPERAS\b|\bSELLO\b', caseSensitive: false):
        'ESTOPERA',
    RegExp(
      r'\bSENSOR\b|\bSENSORES\b|\bSWIFTCH\b|\bSWITCH\b',
      caseSensitive: false,
    ): 'SENSOR',
    RegExp(
      r'\bRADIADOR\b|\bRADIADORES\b|\bDEPOSITO AGUA\b|\bELECTROVENTILADOR\b',
      caseSensitive: false,
    ): 'RADIADOR',
    RegExp(
      r'\bTRIPOIDE\b|\bTRIPOIDES\b|\bTRIPETA\b|\bPUNTA TRIPOIDE\b',
      caseSensitive: false,
    ): 'TRIPOIDE',
    RegExp(r'\bGUAYA\b|\bGUAYAS\b', caseSensitive: false): 'GUAYA',
    RegExp(r'\bEMBRAGUE\b|\bCLUTCH\b|\bCROCHE\b', caseSensitive: false):
        'EMBRAGUE',
    RegExp(r'\bCONCHA\b|\bCONCHAS\b|\bCASQUETES\b', caseSensitive: false):
        'CONCHA',
    RegExp(
      r'\bANILLO\b|\bANILLOS\b|\bPISTON\b|\bPISTONES\b',
      caseSensitive: false,
    ): 'ANILLOS',
    RegExp(r'\bBOBINA\b|\bBOBINAS\b', caseSensitive: false): 'BOBINA',
    RegExp(r'\bSOPORTE\b|\bSOPORTES\b', caseSensitive: false): 'SOPORTE',
    RegExp(r'\bBUJIA\b|\bBUJIAS\b', caseSensitive: false): 'BUJIA',
    RegExp(r'\bMANGUERA\b|\bMANGUERAS\b', caseSensitive: false): 'MANGUERA',
    RegExp(r'\bTERMINAL\b|\bTERMINALES\b|\bROTULA\b', caseSensitive: false):
        'TERMINAL',
    RegExp(r'\bMUÑON\b|\bMUÑONES\b', caseSensitive: false): 'MUÑON',
    RegExp(r'\bCEPILLO\b|\bPARABRISA\b|\bTAPA\b', caseSensitive: false):
        'CARROCERIA',
  };

  /// Clasifica una descripción individual en memoria
  String? classify(String description) {
    if (description.trim().isEmpty) return null;
    for (final MapEntry<RegExp, String> entry in rules.entries) {
      if (entry.key.hasMatch(description)) {
        return entry.value;
      }
    }
    return null;
  }

  /// Procesa un mapa o lista de elementos en memoria
  List<Map<String, String>> parseBatch(List<String> descriptions) {
    final List<Map<String, String>> results = <Map<String, String>>[];
    for (final String desc in descriptions) {
      final String? category = classify(desc);
      if (category != null) {
        results.add(<String, String>{
          'description': desc,
          'category': category,
        });
      }
    }
    return results;
  }
}
