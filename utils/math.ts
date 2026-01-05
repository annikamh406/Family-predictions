
/**
 * Generates a random number from a Normal distribution (Bell curve)
 * using the Box-Muller transform.
 * 
 * @param mean The center of the distribution
 * @param stdev The standard deviation (spread)
 * @returns A random number
 */
export function gaussianRandom(mean = 0, stdev = 1): number {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

/**
 * Clamps a number between a minimum and maximum value.
 */
export function clamp(num: number, min: number, max: number): number {
    return Math.min(Math.max(num, min), max);
}
