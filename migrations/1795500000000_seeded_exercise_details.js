import { groups } from '../data/exercise-muscles-v1.js';

export const up = (pgm) => {
  for (const [muscle, names] of groups) {
    for (const name of names) {
      pgm.sql(`UPDATE exercises SET muscle_detail = '${muscle.replaceAll("'", "''")}'
        WHERE created_by IS NULL AND muscle_detail IS NULL AND name = '${name.replaceAll("'", "''")}'`);
    }
  }
};

export const down = () => {};
