---
name: biz-autopart-pricing
description: Motor integral de comercio automotriz y catálogo (precios y fitment).
owner_node: ruedas
category: analysis
version: 1.0.0
---

# Autopart Pricing & Catalog Matching Engine

## 1. Visión y Propósito
Este skill encapsula la inteligencia comercial y técnica del nodo `Ruedas` para el mercado de autopartes. Resuelve de forma unificada dos grandes desafíos de la industria:
1. **Fijación Dinámica de Precios**: Cálculo de precios netos mediante cascadas de descuentos auditables, conversión de monedas y optimización de márgenes con arbitraje entre mayoristas.
2. **Matching y Compatibilidad de Catálogo**: Normalización de números de pieza (SKU/OEM), resolución de equivalencias cruzadas entre marcas y verificación implacable de compatibilidad (*Fitment*) con año, marca, modelo y motor del vehículo.

---

## 2. Motor de Cascada de Precios (Cascade Pricing)

Calcula el precio final neto a partir del costo mayorista base aplicando reglas jerárquicas auditables:
$$P_1 = P_{\text{base}} \cdot \left(1 - \frac{\text{descuento}_{\text{mayorista}}}{100}\right)$$
$$P_2 = P_1 \cdot \left(1 - \frac{\text{descuento}_{\text{socio}}}{100}\right) + \text{cargo}_{\text{flete}}$$
$$P_{\text{final}} = P_2 \cdot (1 + \text{margen}_{\text{objetivo}})$$

### Arbitraje Inteligente entre Proveedores
Compara cotizaciones simultáneas entre múltiples fuentes (USDM, Mercosur, Andino) identificando el mejor precio neto puesto en destino:
$$\text{Ahorro Arbitraje} = P_{\text{proveedor\_habitual}} - P_{\text{proveedor\_óptimo}}$$

---

## 3. Motor de Matching de Catálogo y Fitment

1. **Normalización Alfanumérica de Códigos**:
   - Eliminación de guiones, espacios y ceros a la izquierda para matching exacto de SKUs (`04465-02220` $\rightarrow$ `0446502220`).
2. **Cruces de Referencia OEM vs Aftermarket**:
   - Mapeo relacional de códigos originales de fabricante a equivalentes de mercado secundario (ej. Bosch, Denso, Ferodo).
3. **Validación de Fitment (Triangulación)**:
   - Verificación de 4 puntos: Marca + Modelo + Rango de Años + Código de Motor / Chasis.
   - Detección de incompatibilidades sutiles (ej. discos de freno para modelos con ABS vs sin ABS).

---

## 4. Salida Estándar para Informes de Autopartes

```markdown
### [COTIZACIÓN Y COMPATIBILIDAD: SKU <NÚMERO_PIEZA>]
- **Descripción**: <Nombre de la pieza y fabricante>
- **Equivalencias OEM Cruzadas**: [<OEM 1>, <OEM 2>, ...]
- **Compatibilidad Vehicular**: [CONFIRMADA (Años/Modelos) | REQUIERE AUDITORÍA | INCOMPATIBLE]
- **Desglose de Precios (Cascada)**:
  - Precio Base: $XX.XX
  - Descuentos Aplicados: -YY%
  - Flete / Logística: +$ZZ.ZZ
  - Precio Neto Final: $WW.WW
- **Mejor Proveedor / Arbitraje**: <Proveedor Recomendado> (Ahorro estimado: $AA.AA)
```
