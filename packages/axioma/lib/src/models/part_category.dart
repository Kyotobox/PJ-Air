class PartCategory {
  final String id;
  final String name;
  final String? iconCode;
  final List<String> keywords;
  final List<String> tags;
  final List<PartCategory> subcategories;
  final int level;
  final Map<String, dynamic>? attributesSchema;

  const PartCategory({
    required this.id,
    required this.name,
    this.iconCode,
    this.subcategories = const <PartCategory>[],
    this.keywords = const <String>[],
    this.tags = const <String>[],
    this.level = 1,
    this.attributesSchema,
  });

  Map<String, dynamic> toMap() {
    return <String, dynamic>{
      'id': id,
      'name': name,
      'level': level,
      'attributesSchema': attributesSchema,
    };
  }

  factory PartCategory.fromMap(Map<String, dynamic> map) {
    return PartCategory(
      id: map['id'] ?? 'unknown',
      name: map['name'] ?? 'Desconocido',
      level: map['level'] ?? 1,
      attributesSchema: map['attributesSchema'],
    );
  }

  static const List<PartCategory> level1 = <PartCategory>[
    PartCategory(
      id: 'engine',
      name: 'Motor',
      iconCode: 'settings',
      keywords: <String>[
        'motor',
        'pistón',
        'válvula',
        'kit tiempo',
        'kit de tiempo',
        'correa',
        'buje',
        'empaque',
      ],
      tags: <String>['mecánica', 'core'],
      subcategories: <PartCategory>[
        PartCategory(
          id: 'engine_pistons',
          name: 'Pistones',
          keywords: <String>['piston', 'anillo'],
        ),
        PartCategory(
          id: 'engine_valves',
          name: 'Válvulas',
          keywords: <String>['valvula', 'guia'],
        ),
        PartCategory(
          id: 'engine_cooling',
          name: 'Enfriamiento',
          keywords: <String>['radiador', 'bomba agua', 'termostato'],
        ),
      ],
    ),
    PartCategory(
      id: 'suspension',
      name: 'Suspensión',
      iconCode: 'unfold_more',
      keywords: <String>[
        'amortiguador',
        'espiral',
        'ballesta',
        'meseta',
        'muñón',
        'terminal',
      ],
      tags: <String>['chasis'],
      subcategories: <PartCategory>[
        PartCategory(
          id: 'susp_shocks',
          name: 'Amortiguadores',
          keywords: <String>['shock', 'strut'],
        ),
        PartCategory(
          id: 'susp_springs',
          name: 'Espirales',
          keywords: <String>['coil'],
        ),
      ],
    ),
    PartCategory(
      id: 'brakes',
      name: 'Frenos',
      iconCode: 'stop_circle',
      keywords: <String>[
        'freno',
        'pastilla',
        'disco',
        'tambor',
        'cilindro',
        'liga',
      ],
      tags: <String>['seguridad'],
      subcategories: <PartCategory>[
        PartCategory(
          id: 'brakes_pads',
          name: 'Pastillas',
          keywords: <String>['pad', 'brake pad'],
        ),
        PartCategory(
          id: 'brakes_discs',
          name: 'Discos',
          keywords: <String>['rotor'],
        ),
      ],
    ),
    PartCategory(
      id: 'electric',
      name: 'Electricidad',
      iconCode: 'electric_bolt',
      keywords: <String>[
        'bateria',
        'alternador',
        'arranque',
        'bujia',
        'cable',
        'bobina',
        'sensor',
      ],
      tags: <String>['eléctrico'],
    ),
    PartCategory(
      id: 'body',
      name: 'Carrocería',
      iconCode: 'directions_car',
      keywords: <String>[
        'parachoque',
        'capot',
        'puerta',
        'vidrio',
        'faro',
        'stop',
        'retrovisor',
      ],
      tags: <String>['estética'],
    ),
    PartCategory(
      id: 'transmission',
      name: 'Transmisión',
      iconCode: 'alt_route',
      keywords: <String>[
        'caja',
        'clutch',
        'croche',
        'tripode',
        'estopera',
        'cardan',
        'diferencial',
      ],
      tags: <String>['tracción'],
    ),
    PartCategory(
      id: 'lubricants',
      name: 'Lubricantes',
      iconCode: 'oil_barrel',
      keywords: <String>[
        'aceite',
        'filtro',
        'grasa',
        'refrigerante',
        'liquido',
      ],
      tags: <String>['mantenimiento'],
    ),
    PartCategory(
      id: 'accessories',
      name: 'Accesorios',
      iconCode: 'extension',
      keywords: <String>[
        'alfombra',
        'forro',
        'ambientador',
        'limpiaparabrisas',
        'herramienta',
      ],
      tags: <String>['confort'],
    ),
    PartCategory(
      id: 'general',
      name: 'General',
      iconCode: 'category',
      keywords: <String>[],
    ),
  ];

  static PartCategory getById(String id) {
    for (PartCategory cat in level1) {
      if (cat.id == id) return cat;
      for (PartCategory sub in cat.subcategories) {
        if (sub.id == id) return sub;
      }
    }
    return level1.last; // General
  }
}
