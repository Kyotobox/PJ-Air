# SPRINT S49 - Sprint 49: Tax ID Obligatorio, Google Maps Real y Lead Time de Despacho 48h
**Objetivo**: Tax ID obligatorio en registro mayorista B2B, integración real de Google Maps (Maps JS, Geocoding, Places), motor de lead time de 48h para despacho y terminología oficial de Delivery Fee.
**Fecha**: 2026-10-30

- [ ] **TASK-49-01** [UI/AUTH-MANDATORY-TAXID] Tax ID / NY Resale Certificate # obligatorio en /auth/register y validación en backend.
- [ ] **TASK-49-02** [INTEGRATION/GOOGLE-MAPS-REAL-KEY] Configuración y verificación de Google Maps API Key real eliminando error Oops! Something went wrong.
- [ ] **TASK-49-03** [UI/PLACES-AUTOCOMPLETE-NYC] Buscador predictivo Google Places Autocomplete en /profile/addresses/new y Checkout inline.
- [ ] **TASK-49-04** [DOMAIN/CUTOFF-LEADTIME-ENGINE] Motor de Lead Time 48h (T+2 pre-12 PM, T+3 post-12 PM hora NY) y guardarraíl de fechas en /checkout.
- [ ] **TASK-49-05** [UI/CHECKOUT-TERMINOLOGY-AND-PICKUP] Renombrar Flete a Delivery Fee, fijar horario Pick Up (8:00 AM - 10:00 AM) y fix de scroll móvil.
- [ ] **TASK-49-06** [DOMAIN/LOGISTICS-CHECKOUT-LINK] Conexión de coordenadas geocodificadas con POST /logistics/quote (MileageFreightService).
- [ ] **TASK-49-07** [TEST/S49-INTEGRATION-SUITE] Suite de pruebas unitarias para TaxID obligatorio, cutoff 48h, fletes y build clean.
