import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config.js';
import { createSchema } from './schema.js';

let db: Database.Database | null = null;

// initialize the database with wal mode and schema creation
export function initDb(): Database.Database {
  if (db) {
    return db;
  }

  // ensure directory exists
  mkdirSync(dirname(config.databasePath), { recursive: true });

  db = new Database(config.databasePath);
  db.pragma('journal_mode = WAL');
  createSchema(db);

  return db;
}

// get the database instance, throws if not initialized
export function getDb(): Database.Database {
  if (!db) {
    throw new Error('database not initialized. call initDb() first.');
  }
  return db;
}

// close the database connection
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
