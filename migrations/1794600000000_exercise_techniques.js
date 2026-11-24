import { techniques } from '../data/exercise-techniques-v1.js';

const quote = (value) => "'" + value.replaceAll("'", "''") + "'";

export const up = (pgm) => {
  for (const [name, technique] of Object.entries(techniques)) {
    pgm.sql(`UPDATE exercises SET technique = ${quote(technique)}
      WHERE created_by IS NULL AND name = ${quote(name)} AND coalesce(btrim(technique), '') = ''`);
  }
};

// These editorial additions can subsequently be edited; retain them on rollback.
export const down = () => {};
