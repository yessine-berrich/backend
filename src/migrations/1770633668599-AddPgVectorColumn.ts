import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPgVectorColumn1720700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajoute la vraie colonne vector(768) — dimension pour nomic-embed-text
    await queryRunner.query(`
      ALTER TABLE articles
      ADD COLUMN IF NOT EXISTS embedding_vector_pg vector(768);
    `);

    // Index HNSW — OBLIGATOIRE pour les recherches rapides
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_embedding_pg
      ON articles USING hnsw (embedding_vector_pg vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);

    // Optionnel : copie les anciens vecteurs (cast auto)
    // Décommente si tu as déjà des données dans l'ancien champ
    await queryRunner.query(`
      UPDATE articles
      SET embedding_vector_pg = embedding_vector::vector
      WHERE embedding_vector IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_articles_embedding_pg;`);
    await queryRunner.query(`ALTER TABLE articles DROP COLUMN IF EXISTS embedding_vector_pg;`);
  }
}