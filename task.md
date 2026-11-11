# SPRINT S78 - Sprint S78: Soberanía de Tarifa Fija por Cliente, Erradicación de Zonas de Delivery y Ajuste Financiero
**Objetivo**: Prevalencia absoluta de tarifa fija pactada por cliente, erradicación completa de zonas de delivery en favor de millaje exclusivo, ajuste financiero de pedidos activos (#060d13ad y #aa910cbb) y sincronización total en testing y producción.
**Fecha**: 2026-11-11

- [x] **TASK-78-01**: Ajuste financiero en base de datos de producción para pedidos #060d13ad ($300.00 flete y balance) y #aa910cbb ($200.00 flete y compensación store credit)
- [x] **TASK-78-02**: Backend: Prevalencia absoluta de tarifa fija de cliente y erradicación total de ZonesService en orders.service.ts (solo Pickup, Tarifa Fija o Millaje)
- [x] **TASK-78-03**: Frontend: Erradicación total de zonas de delivery en checkout/page.tsx, cortocircuito directo para tarifa fija sin cotización innecesaria y cálculo exclusivo por millaje
- [x] **TASK-78-04**: Certificación: Tests automatizados (happy y sad paths), compilación en limpio, despliegue y sincronización en testing y producción VPS
