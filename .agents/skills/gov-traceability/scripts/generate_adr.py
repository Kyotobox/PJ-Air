#!/usr/bin/env python3
"""
Generador Autónomo de ADRs (MADR 3.0.0 / RFC 2119)
Parte de la skill gov-traceability (TASK-N40-01).
"""

import argparse
import datetime
import os
import re
import sys

import unicodedata

VALID_STATUSES = ["PROPOSED", "ACCEPTED", "REJECTED", "DEPRECATED", "SUPERSEDED"]

def slugify(text: str) -> str:
    normalized = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii').lower()
    slug = re.sub(r'[^a-z0-9]+', '-', normalized)
    return slug.strip('-')

def get_next_adr_number(out_dir: str) -> int:
    if not os.path.exists(out_dir):
        return 1
    existing = os.listdir(out_dir)
    numbers = []
    for f in existing:
        m = re.match(r'^(\d{4})-', f)
        if m:
            numbers.append(int(m.group(1)))
    return max(numbers) + 1 if numbers else 1

def generate_adr(
    title: str,
    status: str = "ACCEPTED",
    context: str = "",
    decision: str = "",
    consequences: str = "",
    deciders: str = "Fleet Council",
    technical_story: str = "",
    options: str = "",
    out_dir: str = "docs/adr",
    number: int = None
) -> str:
    if not title or not title.strip():
        sys.stderr.write("ERROR: El título del ADR es mandatorio (--title).\n")
        sys.exit(1)

    status_upper = status.strip().upper()
    if status_upper not in VALID_STATUSES:
        sys.stderr.write(f"ERROR: Estatus '{status}' inválido. Valores permitidos: {', '.join(VALID_STATUSES)}.\n")
        sys.exit(2)

    os.makedirs(out_dir, exist_ok=True)

    if number is None:
        number = get_next_adr_number(out_dir)

    num_str = f"{number:04d}"
    slug = slugify(title)
    filename = f"{num_str}-{slug}.md"
    filepath = os.path.join(out_dir, filename)

    now_str = datetime.date.today().isoformat()
    story_str = technical_story if technical_story else "N/A"
    context_str = context if context else "Se identificó la necesidad de fijar directrices técnicas inmutables."
    decision_str = decision if decision else f"El sistema SHALL adoptar la solución propuesta de forma mandatoria."
    consequences_str = consequences if consequences else "Alineación arquitectónica estricta con cero deuda técnica."
    options_str = options if options else "- Opción A: Enfoque determinista con verificación física.\n- Opción B: Solución ad-hoc no estandarizada."

    content = f"""# {num_str}. {title.strip()}

* **Estatus**: {status_upper}
* **Fecha**: {now_str}
* **Decisores**: {deciders}
* **Historia Técnica**: {story_str}

## Contexto y Declaración del Problema
{context_str}

## Opciones Consideradas
{options_str}

## Resultado de la Decisión (RFC 2119)
{decision_str}

### Consecuencias
* **Positivas**: {consequences_str}
* **Negativas / Riesgos**: Requiere disciplina de ingeniería estricta y cumplimiento de compuertas (§4, §6).
"""

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    return filepath

def main():
    parser = argparse.ArgumentParser(description="Generador de ADRs MADR/RFC 2119")
    parser.add_argument("--title", required=False, help="Título del ADR")
    parser.add_argument("--status", default="ACCEPTED", help="Estatus del ADR")
    parser.add_argument("--context", default="", help="Contexto y justificación")
    parser.add_argument("--decision", default="", help="Decisión adoptada con términos RFC 2119")
    parser.add_argument("--consequences", default="", help="Consecuencias técnicas")
    parser.add_argument("--deciders", default="Fleet Council", help="Entidades o roles decisores")
    parser.add_argument("--story", default="", help="Ticket o Sprint de referencia")
    parser.add_argument("--out-dir", default="docs/adr", help="Directorio destino de los ADRs")
    parser.add_argument("--number", type=int, default=None, help="Número forzado para el ADR")

    args = parser.parse_args()

    if not args.title:
        sys.stderr.write("ERROR: Falta parámetro mandatorio --title.\n")
        sys.exit(1)

    path = generate_adr(
        title=args.title,
        status=args.status,
        context=args.context,
        decision=args.decision,
        consequences=args.consequences,
        deciders=args.deciders,
        technical_story=args.story,
        out_dir=args.out_dir,
        number=args.number
    )

    print(f"ADR generado exitosamente en: {path}")
    sys.exit(0)

if __name__ == "__main__":
    main()
