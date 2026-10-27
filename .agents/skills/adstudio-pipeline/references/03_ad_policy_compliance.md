# Linter de Políticas de Anuncios y Compliance (03_ad_policy_compliance)

## 1. Visión y Propósito
El propósito de este linter es auditar proactivamente guiones, copys y recursos visuales antes de su publicación o pauta publicitaria en Meta Ads (Facebook/Instagram), TikTok for Business y Google Ads.

Un anuncio rechazado daña la calificación de la cuenta publicitaria (*Account Quality Score*); múltiples rechazos provocan el baneo definitivo del Business Manager.

---

## 2. Diccionario de Palabras y Fórmulas Censuradas (Red Flags)

Todo guión generado por `adstudio-pipeline` debe pasar por este filtro de sustitución obligatoria:

| Categoría Prohibida | Ejemplos Censurados | Razón del Baneo algorítmico | Sustitución Segura Aprobada |
| :--- | :--- | :--- | :--- |
| **Promesas de Ingresos / MLM** | "Gana $5,000 en 7 días", "Vuélvete millonario trabajando desde casa", "Ingresos pasivos 100% garantizados" | Violación de política de Oportunidades de Negocio Engañosas (*Unrealistic Claims*). | "Descubre la metodología que utilizamos para escalar proyectos", "Optimiza tus procesos comerciales con nuestro sistema". |
| **Salud y Estética Agresiva** | "Elimina 10 kg de grasa en 2 semanas", "Quítate las arrugas al instante", planos detalle de grasa corporal | Violación de política de Salud Personal y Autoestima Negativa (*Negative Self-Perception*). | "Mejora tus hábitos diarios con esta rutina personalizada", "Acompañamiento integral para tu bienestar". |
| **Atributos Personales Directos** | "¿Estás endeudado?", "¿Tienes sobrepeso?", "¿Cansado de estar soltero?", "¿Sufres de ansiedad?" | Violación estricta de Atributos Personales (*Personal Characteristics*). Prohibido afirmar que el usuario padece una condición. | Hablar en tercera persona o sobre uno mismo: "Muchos profesionales enfrentan problemas de liquidez...", "Cómo resolvimos la desorganización financiera". |
| **Uso no autorizado de Marcas** | "Mejor que Facebook", logos oficiales de TikTok/Instagram con efectos de sangre o alterados | Violación de Marcas Registradas (*Brand Assets*). | Mencionar "redes sociales líderes" o usar los nombres sin alterar su tipografía ni colores oficiales. |

---

## 3. Normativa Mandatoria de Contenido Generado por IA (*AI Disclosure*)

A partir de 2024-2026, tanto Meta como TikTok imponen sanciones severas si un anuncio utiliza avatares sintéticos, clonación de voz o deepfakes sin declararlo:

### Reglas de Etiquetado:
1. **Meta Ads**: Al configurar el anuncio en Ads Manager, es obligatorio marcar la casilla:  
   `[X] Anuncio contiene contenido digitalmente creado o alterado (IA)`.
2. **TikTok Ads**: Es obligatorio habilitar la etiqueta:  
   `[X] Generado con IA / AI-generated`.
3. **Audio / Watermark**: Si el avatar sintético representa a una persona real (ej. el CEO de la empresa), debe existir un consentimiento firmado por escrito archivado en el expediente de la campaña.

---

## 4. Checklist de Pre-Lanzamiento (Gate de Compliance)

Antes de entregar los videos terminados al cliente o programar la pauta:
- [ ] ¿El texto del guión está 100% libre de afirmaciones de ingresos garantizados?
- [ ] ¿El gancho de los primeros 3 segundos evita interpelar atributos médicos o financieros directos?
- [ ] ¿Los subtítulos dinámicos coinciden con la pronunciación del audio sin alterar el mensaje?
- [ ] ¿La música de fondo cuenta con licencia comercial libre de regalías (*Royalty-Free Commercial License*)?
- [ ] ¿Se verificó que la página de destino (*Landing Page*) no contenga testimonios falsos ni temporizadores engañosos?
