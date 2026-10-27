import 'dart:io';

import 'package:test/test.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('TestDatabaseFactory (TASK-G173-03)', () {
    const TestDatabaseFactory factory = TestDatabaseFactory();
    late String tempDir;

    setUp(() {
      tempDir = Directory.systemTemp
          .createTempSync('test_db_factory_test_')
          .path;
    });

    tearDown(() {
      factory.purgeScratch(tempDir);
    });

    test('Happy Path: createInMemory instantiates functional SQLite database with foreign keys and DDL', () {
      final Database db = factory.createInMemory(
        initialDdl: <String>[
          '''
          CREATE TABLE categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
          );
          ''',
          '''
          CREATE TABLE products (
            id TEXT PRIMARY KEY,
            category_id TEXT NOT NULL,
            title TEXT NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (category_id) REFERENCES categories (id)
          );
          ''',
        ],
      );

      try {
        db.execute(
          "INSERT INTO categories (id, name) VALUES ('CAT-1', 'Brakes');",
        );
        db.execute(
          "INSERT INTO products (id, category_id, title, price) VALUES ('PROD-1', 'CAT-1', 'Ceramic Brake Pads', 89.99);",
        );

        final ResultSet results = db.select(
          'SELECT * FROM products WHERE id = ?;',
          <Object?>['PROD-1'],
        );
        expect(results.length, 1);
        final Row row = results.first;
        expect(row['title'], 'Ceramic Brake Pads');
        expect(row['price'], 89.99);
      } finally {
        factory.close(db);
      }
    });

    test('Happy Path: createScratch persists SQLite database to disk and purge cleans it up', () {
      final Database db = factory.createScratch(
        scratchDir: tempDir,
        name: 'custom_scratch.db',
        initialDdl: <String>[
          'CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT);',
        ],
      );

      final String expectedFilePath =
          '$tempDir${Platform.pathSeparator}custom_scratch.db';
      expect(File(expectedFilePath).existsSync(), isTrue);

      db.execute("INSERT INTO audit_log (action) VALUES ('INITIALIZE');");
      final ResultSet res = db.select('SELECT COUNT(*) as cnt FROM audit_log;');
      expect(res.first['cnt'], 1);

      factory.close(db);

      // Verify file is closed and purge removes it
      factory.purgeScratch(tempDir);
      expect(Directory(tempDir).existsSync(), isFalse);
    });

    test('Sad Path: Foreign key constraint is strictly enforced', () {
      final Database db = factory.createInMemory(
        initialDdl: <String>[
          'CREATE TABLE parent (id TEXT PRIMARY KEY);',
          'CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parent(id));',
        ],
      );

      try {
        expect(
          () => db.execute(
            "INSERT INTO child (id, parent_id) VALUES ('C-1', 'NON-EXISTENT');",
          ),
          throwsA(isA<SqliteException>()),
        );
      } finally {
        factory.close(db);
      }
    });

    test('Sad Path: Malformed initial DDL throws SqliteException cleanly', () {
      expect(
        () => factory.createInMemory(
          initialDdl: <String>['CREATE INVALID SQL TABLE SYNTAX !!!'],
        ),
        throwsA(isA<SqliteException>()),
      );
    });

    test(
      'Sad Path: Closing database multiple times is safe and non-crashing',
      () {
        final Database db = factory.createInMemory();
        factory.close(db);
        expect(() => factory.close(db), returnsNormally);
      },
    );
  });
}
