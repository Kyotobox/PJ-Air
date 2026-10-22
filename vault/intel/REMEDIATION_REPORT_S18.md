# REPORTE DE REMEDIACIÓN Y OPTIMIZACIÓN UI/UX — SPRINT S18
**Fecha de Ejecución**: 2026-10-22  
**Proyecto**: pj-air (Jhoanes Bakery)  
**Versión de Gobernanza**: 4.0.0  
**Estado del Sprint**: COMPLETED  

---

## 1. Resumen Ejecutivo
El Sprint S18 resolvió deficiencias críticas detectadas durante la fase de auditoría del frontend en S17, abordando:
1. **Consistencia Financiera**: Corrección del bug crítico de doble descuento multiplicativo en `CartContext` y el proceso de checkout.
2. **Seguridad y Control de Acceso Edge**: Implementación de `middleware.ts` en Next.js con sincronización de cookies de sesión para eliminar el parpadeo de contenido no autorizado (FOUC).
3. **Higiene y Desacoplamiento Arquitectónico**: Desinstalación de la dependencia exiliada `@supabase/supabase-js`, eliminación de la ruta muerta/clon `admin/productos2` y saneamiento de componentes residuales.

---

## 2. Detalle de Remediaciones

### TASK-18-01: Corrección de Bug Financiero de Doble Descuento
- **Diagnóstico**: Previamente, `CartContext.getRawSubtotal()` aplicaba descuentos específicos por producto a nivel unitario, y subsecuentemente `getDiscountedSubtotal()` multiplicaba todo el subtotal por `(1 - general_discount / 100)`. Adicionalmente, `checkout/page.tsx` ejecutaba una doble reducción en cascada en `handleSubmit` (`items.map`), provocando pérdidas financieras sistemáticas al aplicar ambos beneficios de manera multiplicativa.
- **Solución Implementada**:
  - Se alineó la lógica matemática del Frontend con la fórmula canónica del Backend en `OrdersService.calculateOrderPricesAndTotal`:
    $$\text{Precio Final} = \begin{cases} 
      \text{special\_price} & \text{si existe descuento específico de precio fijo} \\
      \text{precio\_base} \times (1 - \text{descuento\_producto} / 100) & \text{si existe descuento específico en porcentaje} \\
      \text{precio\_base} \times (1 - \text{descuento\_general} / 100) & \text{si el usuario tiene descuento general} \\
      \text{precio\_base} & \text{en caso contrario}
    \end{cases}$$
  - Se incorporó la función determinista `getItemPrice(item: CartItem)` en `CartContext`, asegurando que `price_at_time` enviado en la orden de compra coincide al milímetro con la liquidación transaccional de TypeORM.
  - Se corrigió el cálculo de subtotales, descuentos totales y la exoneración del cargo de delivery en modalidad *Pick Up*.

### TASK-18-02: Implementación de Middleware Next.js y Sincronización de Sesión
- **Diagnóstico**: Las páginas bajo `/admin`, `/delivery`, `/produccion`, `/orders` y `/profile` dependían exclusivamente de validaciones en componentes cliente (`useEffect`), permitiendo la renderización breve de interfaces privadas antes de redireccionar al login (FOUC).
- **Solución Implementada**:
  - Creación de `frontend/middleware.ts` con inspección de cookies en Edge Runtime.
  - Decodificación y validación de expiración de JWT (`exp`) y roles RBAC (`admin`, `delivery`, `produccion`, `client`).
  - Redirección automática a `/auth/login?redirect={pathname}` para usuarios anónimos o tokens expirados.
  - Sincronización bidireccional de cookies de sesión (`auth_token` y `session_role`) en `AuthContext.tsx` (`updateLocalSession`, `fetchUserProfile`, `signOut`) y `lib/api.ts` (limpieza automática ante errores 401).

### TASK-18-03: Desinstalación de Supabase y Limpieza de Código Muerto
- **Diagnóstico**: Pese a la migración exitosa a PostgreSQL/NestJS en S16, el frontend mantenía `@supabase/supabase-js` en `package.json`, archivos de cliente residuales (`lib/supabase.ts`) y la ruta duplicada `app/admin/productos2/page.tsx`.
- **Solución Implementada**:
  - Desinstalación de `@supabase/supabase-js` de `frontend/package.json`.
  - Reemplazo de dependencias de tipos de Supabase (`User`, `Session`) por contratos limpios nativos en `frontend/context/AuthContext.tsx`.
  - Saneamiento de `DevTools.tsx`, eliminando consultas a Supabase y conectando la sincronización de catálogo con el API del backend NestJS.
  - Eliminación definitiva del archivo `frontend/lib/supabase.ts`, del script obsoleto `frontend/scripts/manual-restore.js` y del directorio clonado `frontend/app/admin/productos2/`.
  - Saneamiento de advertencias de variables de entorno en `frontend/lib/config.ts`.

---

## 3. Estado de Certificación
- **Paridad Matemática**: 100% verificada entre `CartContext` y `OrdersService.calculateOrderPricesAndTotal`.
- **RBAC Edge**: 100% verificado en `frontend/middleware.ts`.
- **Higiene de Dependencias**: Libre de bibliotecas de pasarelas/BaaS exiliadas.
