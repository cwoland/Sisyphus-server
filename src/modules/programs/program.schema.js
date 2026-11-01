import { z } from 'zod';

const setPlanSchema = z.object({
  mode: z.enum(['normal', 'drop']),
  restSec: z.number().int().min(0).max(900),
  steps: z.array(
    z.object({
      weight: z.number().min(0).max(9999),
      reps: z.number().int().min(1).max(200),
    })
  ).max(10).default([]),
}).superRefine((plan, ctx) => {
  if (plan.mode === 'drop' && plan.steps.length < 2) {
    ctx.addIssue({
      code: 'custom',
      message: 'В дропсете нужно от 2 до 10 ступеней',
    });
  }

  if (plan.mode === 'normal' && plan.steps.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Ступени доступны только для дропсета',
    });
  }
});

const exerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  targetSets: z.number().int().min(1).max(20),
  targetReps: z.string().trim().min(1).max(20),
  notes: z.string().nullable().optional(),
  groupIndex: z.number().int().min(0).max(500).optional(),
  setPlan: setPlanSchema.nullable().optional(),
});

export const programSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  kind: z.enum(['strength', 'crossfit']).default('strength'),
  days: z.array(
    z.object({
      id: z.string().uuid().optional(),
      title: z.string().trim().min(1).max(150),
      exercises: z.array(exerciseSchema).min(1).max(100),
    })
  ).min(1).max(30),
}).superRefine((program, ctx) => {
  program.days.forEach((day, dayIndex) => {
    const groups = new Map();
    let previous;

    day.exercises.forEach((ex, i) => {
      const key = ex.groupIndex ?? i;

      if (groups.has(key) && previous !== key) {
        ctx.addIssue({
          code: 'custom',
          path: ['days', dayIndex],
          message: 'Упражнения группы должны идти подряд',
        });
      }

      if (!groups.has(key)) groups.set(key, []);

      groups.get(key).push(ex);
      previous = key;
    });

    for (const members of groups.values()) {
      const fail = (message) => {
        ctx.addIssue({
          code: 'custom',
          path: ['days', dayIndex],
          message,
        });
      };

      const drops = members.filter(
        (ex) => ex.setPlan?.mode === 'drop'
      );

      if (
        drops.length &&
        (program.kind === 'crossfit' || members.length !== 1)
      ) {
        fail(
          'Дропсет должен быть отдельным упражнением силовой программы'
        );
      }

      if (drops.some((ex) => ex.targetSets !== 1)) {
        fail('Дропсет — одна серия ступеней');
      }

      if (
        program.kind === 'strength' &&
        members.length > 2
      ) {
        fail('В суперсете должно быть два упражнения');
      }

      if (members.length > 1) {
        if (
          new Set(
            members.map((ex) => ex.exerciseId)
          ).size !== members.length
        ) {
          fail('В группе должны быть разные упражнения');
        }

        if (
          new Set(
            members.map((ex) => ex.targetSets)
          ).size !== 1
        ) {
          fail(
            'У упражнений группы должно быть одинаковое число раундов'
          );
        }

        if (
          new Set(
            members.map(
              (ex) => ex.setPlan?.restSec ?? 120
            )
          ).size !== 1
        ) {
          fail('У группы должен быть общий отдых');
        }
      }
    }
  });
});