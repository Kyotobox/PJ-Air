import { resolveCroissantGroup, isCroissantCategory, CROISSANT_GROUPS } from './croissant-groups';

describe('Canonical Croissant Groups Classification (TASK-92-02 & TASK-92-03)', () => {
  describe('Happy Path: Grupo 1 Plain (11 products)', () => {
    const plainProducts = [
      'Artisanal Croissant',
      'Blueberry Lavender Croissant',
      'Cookie Croissant',
      'Dubai Chocolate Croiss',
      'Dubai Chocolate Croissant',
      'Dulce de Leche Croissant',
      'Lemon Pie Croissant',
      'Mango Croissant',
      'Nutella Strawberry Croissant',
      'Pineapple Coconut Croissant',
      'Strawberry Croissant',
      'Tiramisu Croissant',
    ];

    plainProducts.forEach(name => {
      it(`correctly classifies ${name} as Grupo 1 (Plain)`, () => {
        expect(resolveCroissantGroup(name)).toBe('1');
      });
    });
  });

  describe('Happy Path: Grupo 2 De Colores (10 products)', () => {
    const colorProducts = [
      'Almond Croissant',
      'Banoffee Croissant',
      'Beef Puff Pastry',
      'Chicken Puff Pastry',
      'Chocolate Mousse Croissant',
      'Fruit Danish',
      'Nutella New York Roll',
      'Pain au Chocolat',
      'Pistachio Croissant',
      'Raspberry Croissant',
    ];

    colorProducts.forEach(name => {
      it(`correctly classifies ${name} as Grupo 2 (De Colores)`, () => {
        expect(resolveCroissantGroup(name)).toBe('2');
      });
    });
  });

  describe('Happy Path: Grupo 3 Small Croissants (4 products)', () => {
    const smallProducts = [
      'Small Artisanal Croissant',
      'Small Chocolate Mousse Croissant',
      'Small Pistachio Croissant',
      'Small Raspberry Croissant',
    ];

    smallProducts.forEach(name => {
      it(`correctly classifies ${name} as Grupo 3 (Small)`, () => {
        expect(resolveCroissantGroup(name)).toBe('3');
      });
    });
  });

  describe('Sad Path (§6) & Boundary Validations', () => {
    it('Sad Path 1: handles undefined and null product names gracefully by returning default group 1', () => {
      expect(resolveCroissantGroup(undefined)).toBe('1');
      expect(resolveCroissantGroup(null as any)).toBe('1');
      expect(resolveCroissantGroup('')).toBe('1');
      expect(resolveCroissantGroup('   ')).toBe('1');
    });

    it('Sad Path 2: prioritizes explicit productionGroup over name-based heuristic', () => {
      // Even if name says Almond (which would normally be 2), if admin set group 1, respect it
      expect(resolveCroissantGroup('Almond Croissant', '1')).toBe('1');
      // Even if name says Artisanal (normally 1), if admin set group 2, respect it
      expect(resolveCroissantGroup('Artisanal Croissant', '2')).toBe('2');
      // Respect group 3
      expect(resolveCroissantGroup('Regular Croissant', '3')).toBe('3');
    });

    it('Sad Path 3: handles unknown product names without crashing', () => {
      expect(resolveCroissantGroup('Random Mystery Pastry')).toBe('1');
    });

    it('Sad Path 4: handles case insensitivity and whitespace', () => {
      expect(resolveCroissantGroup('   almond CROISSANT  ')).toBe('2');
      expect(resolveCroissantGroup('SMALL artisanal croissant')).toBe('3');
      expect(resolveCroissantGroup('ARTISANAL CROISSANT')).toBe('1');
    });

    it('Sad Path 5: isCroissantCategory correctly identifies croissant categories and rejects others', () => {
      expect(isCroissantCategory('Croissants')).toBe(true);
      expect(isCroissantCategory('CROISSANT')).toBe(true);
      expect(isCroissantCategory('Gourmet Croissants')).toBe(true);
      expect(isCroissantCategory('Pastelería')).toBe(false);
      expect(isCroissantCategory('Panadería')).toBe(false);
      expect(isCroissantCategory(undefined)).toBe(false);
      expect(isCroissantCategory('')).toBe(false);
    });

    it('Boundary: tray division calculation (Factor 12)', () => {
      const units = 529;
      const fullTrays = Math.floor(units / 12);
      const extraUnits = units % 12;
      expect(fullTrays).toBe(44);
      expect(extraUnits).toBe(1);
      expect((units / 12).toFixed(2)).toBe('44.08');
    });
  });
});
