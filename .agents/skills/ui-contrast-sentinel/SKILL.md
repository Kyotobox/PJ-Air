---
name: ui-contrast-sentinel
description: Auditoría de contraste y legibilidad visual WCAG 2.1 AA en árboles de tokens y esquemas de color exportados.
owner_node: Smart
category: tooling
version: 1.0.0
---

# UI Contrast Sentinel (ui-contrast-sentinel)

## 1. Visión y Propósito
El skill `ui-contrast-sentinel` proporciona un motor determinista y ejecutable para la auditoría física de contraste cromático y legibilidad visual conforme al estándar internacional **WCAG 2.1 AA** (y variantes AAA / UI Components) sobre árboles de tokens de diseño, paletas exportadas y esquemas de color de la flota.

Su propósito fundamental es impedir la degradación de la experiencia de usuario y accesibilidad visual, detectando de forma temprana pares ilegibles (como texto gris sobre fondo gris o texto blanco sobre fondos claros) antes del despliegue en interfaces web o móviles.

## 2. Principios de Arquitectura y Calm Error UX (§6)
1. **Verdad Atómica y Cálculo Matemático Exacto (§4, §54)**: El cómputo de luminancia relativa y ratio de contraste implementa con precisión matemática las fórmulas oficiales del W3C para el espacio de color sRGB:
   $$L = 0.2126 \times R_{lin} + 0.7152 \times G_{lin} + 0.0722 \times B_{lin}$$
   $$CR = \frac{L_{lighter} + 0.05}{L_{darker} + 0.05}$$
2. **Calm Error UX y Degradación Suave**: Errores sintácticos en archivos de tokens no generan caídas abruptas ni excepciones no controladas. El sistema emite un reporte estructurado en JSON con el diagnóstico exacto del defecto.
3. **Paridad Multi-OS**: Ejecución agnóstica en entornos Linux VPS y Windows con soporte completo para codificación UTF-8.
4. **Pre-Flight Linter Integrado**: Validador sintáctico que inspecciona la integridad de los códigos hexadecimales (#RGB, #RRGGBB, #RRGGBBAA) y la correspondencia de pares antes de evaluar ratios.

## 3. Contratos de Entrada y Salida (I/O Contracts)

### Parámetros de Línea de Comandos (CLI)
* `--input <PATH>` (`-i`): Ruta al archivo JSON con el árbol de tokens, paleta o lista de pares (o `-` para stdin).
* `--fg <COLOR>`: Color de primer plano para verificación individual directa.
* `--bg <COLOR>`: Color de fondo para verificación individual directa.
* `--name <STRING>`: Identificador o etiqueta del par evaluado (por defecto: `cli_pair`).
* `--threshold <FLOAT>` (`-t`): Ratio numérico mínimo exigido (por defecto: `4.5` para WCAG 2.1 AA normal).
* `--level <AA|AA-LARGE|UI|AAA|AAA-LARGE>` (`-l`): Nivel normativo WCAG:
  * `AA`: Ratio $\ge$ 4.5:1 (texto regular).
  * `AA-LARGE` / `UI`: Ratio $\ge$ 3.0:1 (texto grande $\ge$ 18pt o componentes gráficos).
  * `AAA`: Ratio $\ge$ 7.0:1 (texto regular mejorado).
  * `AAA-LARGE`: Ratio $\ge$ 4.5:1 (texto grande mejorado).
* `--preflight` / `--lint`: Modo pre-flight linter: verifica sintaxis de tokens y códigos de color sin emitir dictamen de contraste.
* `--format <json|text>` (`-f`): Formato de salida (por defecto: `json`).
* `--output <PATH>` (`-o`): Ruta de archivo donde persistir el reporte resultante.
* `--verbose` (`-v`): Emite telemetría diagnóstica a `stderr`.

### Códigos de Retorno (Exit Codes)
* `0`: Evaluación exitosa; todos los pares satisfacen o superan el umbral WCAG requerido (o pre-flight sintáctico exitoso).
* `1`: **Déficit de Contraste (`CONTRAST_DEFICIT`)**; uno o más pares evaluados no alcanzan el ratio exigido. Emite JSON detallado con el ratio numérico exacto de cada violación.
* `2`: Error sintáctico en argumentos de invocación, archivo no encontrado o código de color no parseable.

## 4. Esquema de Salida JSON

### Ejemplo ante Déficit de Contraste (Sad Path, Exit Code 1)
```json
{
  "status": "CONTRAST_DEFICIT",
  "verdict": "FAIL",
  "wcag_level": "AA",
  "required_threshold": 4.5,
  "total_pairs_evaluated": 2,
  "violations_count": 2,
  "passed_count": 0,
  "violations": [
    {
      "name": "muted_on_disabled",
      "status": "CONTRAST_DEFICIT",
      "foreground": "#777777",
      "background": "#888888",
      "contrast_ratio": 1.26,
      "required_threshold": 4.5,
      "wcag_level": "AA",
      "category": "text",
      "fg_luminance": 0.1845,
      "bg_luminance": 0.2462,
      "message": "Contrast ratio 1.26:1 is below the required WCAG 2.1 AA threshold of 4.5:1"
    },
    {
      "name": "white_on_light_gray",
      "status": "CONTRAST_DEFICIT",
      "foreground": "#FFFFFF",
      "background": "#E0E0E0",
      "contrast_ratio": 1.32,
      "required_threshold": 4.5,
      "wcag_level": "AA",
      "category": "text",
      "fg_luminance": 1.0,
      "bg_luminance": 0.7454,
      "message": "Contrast ratio 1.32:1 is below the required WCAG 2.1 AA threshold of 4.5:1"
    }
  ],
  "pairs": [ ... ]
}
```

### Ejemplo ante Éxito (Happy Path, Exit Code 0)
```json
{
  "status": "PASS",
  "verdict": "PASS",
  "wcag_level": "AA",
  "required_threshold": 4.5,
  "total_pairs_evaluated": 1,
  "violations_count": 0,
  "passed_count": 1,
  "violations": [],
  "pairs": [
    {
      "name": "primary_text_on_surface",
      "status": "PASS",
      "foreground": "#FFFFFF",
      "background": "#003366",
      "contrast_ratio": 12.61,
      "required_threshold": 4.5,
      "wcag_level": "AA",
      "category": "text",
      "fg_luminance": 1.0,
      "bg_luminance": 0.0333
    }
  ]
}
```

## 5. Ejemplos de Invocación desde Terminal y CLI
```bash
# 1. Auditoría de árbol de tokens exportado
python3 .agents/skills/ui-contrast-sentinel/scripts/audit_contrast.py --input tokens.json

# 2. Verificación rápida de un par cromático
python3 .agents/skills/ui-contrast-sentinel/scripts/audit_contrast.py --fg "#FFFFFF" --bg "#003366"

# 3. Pre-flight linter sintáctico de definiciones de color
python3 .agents/skills/ui-contrast-sentinel/scripts/audit_contrast.py --input tokens.json --preflight

# 4. Auditoría estricta WCAG AAA para texto corporativo
python3 .agents/skills/ui-contrast-sentinel/scripts/audit_contrast.py --input tokens.json --level AAA --output report.json
```

## 6. Certificación Constitucional (§4, §6, §43, §48, §55)
* **Suite de Pruebas**: `test/skills/ui_contrast_sentinel_test.dart` certifica el Happy Path con esquemas de alto contraste, el Sad Path obligatorio con pares ilegibles (`CONTRAST_DEFICIT`, exit code 1), validación de pre-flight y boundary checking.
* **Compuerta Mecánica**: Verificado con `logix audit skills` bajo la Regla §55 (cero placebos, scripts ejecutables físicos y trazabilidad en el manifiesto).
