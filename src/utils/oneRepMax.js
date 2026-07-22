export const estimateOneRepMax = (weight, reps) => {
    if (!weight || !reps || reps < 1) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
};