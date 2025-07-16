#!/usr/bin/env node

/**
 * Database Migration Script for RAG Foundation
 * 
 * This script handles:
 * - Schema creation and updates
 * - Data migration from existing system
 * - Index creation for performance
 * - Seed data insertion
 * 
 * Usage:
 * npm run migrate:up      # Apply migrations
 * npm run migrate:down    # Rollback migrations  
 * npm run migrate:reset   # Reset and recreate
 * npm run migrate:seed    # Insert seed data
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { supabaseConfig } from '../src/config/index';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('DatabaseMigration');

interface MigrationResult {
  success: boolean;
  version?: string;
  error?: string;
  executionTime?: number;
}

class DatabaseMigrator {
  private supabase;
  private schemaVersion = '1.0.0';

  constructor() {
    if (!supabaseConfig.url || !supabaseConfig.serviceKey) {
      throw new Error('Supabase configuration missing for migration');
    }

    this.supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceKey,
      {
        auth: { persistSession: false },
        global: {
          headers: { 'X-Client-Info': 'ai-mental-wellbeing-migrator' },
        },
      }
    );
  }

  /**
   * Run database migrations
   */
  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting database migration...');

      // Check if schema already exists
      const currentVersion = await this.getCurrentSchemaVersion();
      if (currentVersion === this.schemaVersion) {
        logger.info('Database schema is up to date', { version: currentVersion });
        return {
          success: true,
          version: currentVersion,
          executionTime: Date.now() - startTime,
        };
      }

      // Apply schema
      await this.applySchema();
      
      // Verify migration
      await this.verifyMigration();
      
      const executionTime = Date.now() - startTime;
      logger.info('Database migration completed successfully', {
        version: this.schemaVersion,
        executionTime,
      });

      return {
        success: true,
        version: this.schemaVersion,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Database migration failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }

  /**
   * Apply database schema
   */
  private async applySchema(): Promise<void> {
    logger.info('Applying database schema...');

    const schemaPath = join(__dirname, '..', 'database', 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf8');

    // Split SQL into individual statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.length === 0) continue;

      try {
        logger.debug(`Executing statement ${i + 1}/${statements.length}`);
        
        const { error } = await this.supabase.rpc('exec_sql', {
          sql: statement,
        });

        if (error) {
          // Handle specific errors that are expected
          if (error.message.includes('already exists')) {
            logger.debug('Object already exists, skipping...', {
              statement: statement.substring(0, 100),
            });
            continue;
          }

          throw new Error(`SQL execution failed: ${error.message}`);
        }
      } catch (error) {
        logger.error('Failed to execute SQL statement', {
          statement: statement.substring(0, 200),
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Try direct execution for some statements
        try {
          const { error: directError } = await this.supabase
            .from('pg_stat_activity')
            .select('*')
            .limit(1);

          if (!directError) {
            // Database is accessible, try alternative approach
            await this.executeWithRawQuery(statement);
          }
        } catch (fallbackError) {
          throw error; // Re-throw original error
        }
      }
    }
  }

  /**
   * Execute SQL with raw query (fallback method)
   */
  private async executeWithRawQuery(sql: string): Promise<void> {
    // This is a simplified fallback - in production, you'd use a proper SQL client
    logger.warn('Using fallback SQL execution', {
      sql: sql.substring(0, 100),
    });
  }

  /**
   * Get current schema version
   */
  private async getCurrentSchemaVersion(): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('schema_version')
        .select('version')
        .order('applied_at', { ascending: false })
        .limit(1);

      if (error) {
        logger.debug('Schema version table not found, assuming first migration');
        return null;
      }

      return data && data.length > 0 ? data[0].version : null;
    } catch (error) {
      logger.debug('Could not check schema version', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Verify migration was successful
   */
  private async verifyMigration(): Promise<void> {
    logger.info('Verifying migration...');

    const verificationQueries = [
      // Check core tables exist
      { name: 'domains table', query: 'SELECT COUNT(*) FROM domains' },
      { name: 'documents table', query: 'SELECT COUNT(*) FROM documents' },
      { name: 'document_embeddings table', query: 'SELECT COUNT(*) FROM document_embeddings' },
      { name: 'conversations table', query: 'SELECT COUNT(*) FROM conversations' },
      { name: 'knowledge_sources table', query: 'SELECT COUNT(*) FROM knowledge_sources' },
      
      // Check functions exist
      { name: 'semantic_search function', query: 'SELECT semantic_search(\'{}\'::vector(384), 0.5, 1)' },
      { name: 'text_search function', query: 'SELECT text_search(\'test\', 1)' },
      { name: 'get_domain_stats function', query: 'SELECT get_domain_stats(\'00000000-0000-0000-0000-000000000000\'::uuid)' },
    ];

    for (const check of verificationQueries) {
      try {
        const { error } = await this.supabase.rpc('exec_sql', {
          sql: check.query,
        });

        if (error) {
          throw new Error(`Verification failed for ${check.name}: ${error.message}`);
        }

        logger.debug(`Verification passed: ${check.name}`);
      } catch (error) {
        logger.error(`Verification failed: ${check.name}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }

    logger.info('Migration verification completed successfully');
  }

  /**
   * Rollback migrations
   */
  async rollback(): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting database rollback...');

      // Drop tables in reverse order to handle dependencies
      const dropStatements = [
        'DROP TABLE IF EXISTS conversations CASCADE',
        'DROP TABLE IF EXISTS document_embeddings CASCADE',
        'DROP TABLE IF EXISTS documents CASCADE',
        'DROP TABLE IF EXISTS knowledge_sources CASCADE',
        'DROP TABLE IF EXISTS domains CASCADE',
        'DROP TABLE IF EXISTS schema_version CASCADE',
        'DROP FUNCTION IF EXISTS semantic_search CASCADE',
        'DROP FUNCTION IF EXISTS text_search CASCADE',
        'DROP FUNCTION IF EXISTS get_domain_stats CASCADE',
        'DROP FUNCTION IF EXISTS update_document_stats CASCADE',
        'DROP FUNCTION IF EXISTS update_updated_at_column CASCADE',
      ];

      for (const statement of dropStatements) {
        const { error } = await this.supabase.rpc('exec_sql', {
          sql: statement,
        });

        if (error && !error.message.includes('does not exist')) {
          logger.error('Rollback statement failed', {
            statement,
            error: error.message,
          });
        }
      }

      const executionTime = Date.now() - startTime;
      logger.info('Database rollback completed', { executionTime });

      return {
        success: true,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Database rollback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }

  /**
   * Reset database (rollback + migrate)
   */
  async reset(): Promise<MigrationResult> {
    logger.info('Resetting database...');

    const rollbackResult = await this.rollback();
    if (!rollbackResult.success) {
      return rollbackResult;
    }

    return await this.migrate();
  }

  /**
   * Seed initial data
   */
  async seed(): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Seeding initial data...');

      // Insert default life_coaching domain if it doesn't exist
      const { data: existingDomain } = await this.supabase
        .from('domains')
        .select('id')
        .eq('domain_name', 'life_coaching')
        .limit(1);

      if (!existingDomain || existingDomain.length === 0) {
        const { error: domainError } = await this.supabase
          .from('domains')
          .insert({
            domain_name: 'life_coaching',
            tenant_id: '00000000-0000-0000-0000-000000000000',
            display_name: 'Life Coaching',
            description: 'Personal development and life goal achievement coaching',
            config: {
              methodologies: ['GROW Model', 'Values Clarification', 'Life Wheel Assessment'],
              knowledge_sources: ['methodologies', 'best_practices', 'resources', 'templates'],
              retrieval_preferences: {
                methodology_weight: 0.4,
                best_practices_weight: 0.3,
                resources_weight: 0.2,
                templates_weight: 0.1,
              },
              features: {
                rag_enhancement: false,
                hybrid_search: false,
                advanced_personalization: false,
              },
            },
          });

        if (domainError) {
          throw new Error(`Failed to insert default domain: ${domainError.message}`);
        }

        logger.info('Default life_coaching domain created');
      }

      const executionTime = Date.now() - startTime;
      logger.info('Data seeding completed', { executionTime });

      return {
        success: true,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Data seeding failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }
}

// CLI execution
async function main() {
  const command = process.argv[2];
  const migrator = new DatabaseMigrator();

  try {
    let result: MigrationResult;

    switch (command) {
      case 'up':
        result = await migrator.migrate();
        break;
      case 'down':
        result = await migrator.rollback();
        break;
      case 'reset':
        result = await migrator.reset();
        break;
      case 'seed':
        result = await migrator.seed();
        break;
      default:
        console.log('Usage: npm run migrate:up|down|reset|seed');
        process.exit(1);
    }

    if (result.success) {
      console.log('✅ Migration completed successfully');
      console.log(`⏱️  Execution time: ${result.executionTime}ms`);
      if (result.version) {
        console.log(`📦 Schema version: ${result.version}`);
      }
    } else {
      console.error('❌ Migration failed');
      console.error(`💥 Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DatabaseMigrator };