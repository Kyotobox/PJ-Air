# Inteligencia de Voz y Análisis de Objeciones Comerciales (voice_objections_insights)

## 1. Visión y Propósito
Este módulo procesa transcripciones de llamadas comerciales, demos de producto y sesiones de soporte para extraer inteligencia accionable. Cierra la brecha entre lo que el cliente dice y las decisiones de producto/ventas:

1. **Detección de Objeciones Críticas**: Precio, falta de funcionalidades, desconfianza técnica o inercia de proveedor actual.
2. **Identificación de Painkillers vs Vitaminas**: Mapeo directo de los problemas urgentes que motivaron la llamada.
3. **Señales de Compra y Nivel de Urgencia**: Scoring de la probabilidad de cierre a 30 días.

---

## 2. Taxonomía de Análisis de Transcripciones

1. **Extracción de Entidades Comerciales**:
   - Competidores mencionados en la conversación.
   - Presupuesto o rango de precios revelado.
   - Plazo de toma de decisión (*Timeline*).
2. **Clasificación de Sentimiento y Objeciones**:
   - `OBJ_PRICE`: Objeción de precio / ROI percibido insuficiente.
   - `OBJ_TECH`: Duda sobre compatibilidad, stack o seguridad de datos.
   - `OBJ_AUTHORITY`: El interlocutor no tiene autoridad final de firma.
   - `OBJ_NEED`: No siente la urgencia del problema ("podemos esperar").

---

## 3. Salida Estándar para Informes de Llamadas Comerciales

```markdown
### [INTELIGENCIA DE VENTAS: LLAMADA <CLIENTE / PROSPECTO>]
- **Nivel de Urgencia / Temperatura**: [CALIENTE (Cierre <30d) | TIBIO | FRÍO]
- **Dolor Principal Expresado**: <Cita o paráfrasis del problema real>
- **Objeciones Detectadas**:
  - [Objeción 1] $\rightarrow$ *Argumento de Refutación Recomendado*: <Respuesta>
  - [Objeción 2] $\rightarrow$ *Argumento de Refutación Recomendado*: <Respuesta>
- **Competidores Mencionados**: [<Competidor 1>, <Competidor 2>]
- **Acción Inmediata para el SDR/Account Executive**: <Siguiente paso sugerido>
```
