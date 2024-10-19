/**
 * Creates a replacer function for JSON.stringify that limits the depth of nested objects.
 *
 * @param {number} maxDepth - The maximum depth of nested objects to include. Defaults to 3.
 * @returns {(this: any, key: string, value: any) => any} A replacer function for use with JSON.stringify.
 *
 * @example
 * const deepObject = {
 *   level1: {
 *     level2: {
 *       level3: {
 *         level4: "Too deep"
 *       }
 *     }
 *   }
 * };
 * const limitedJson = JSON.stringify(deepObject, depthLimiter(2), 2);
 * Result:
 * {
 *   "level1": {
 *     "level2": {}
 *   }
 * }
 */
export function depthLimiter(maxDepth: number = 3): (this: any, key: string, value: any) => any {
  return (function () {
    const seen = new WeakMap();
    return function (this: any, key: string, value: any): any {
      if (typeof value === 'object' && value !== null) {
        let depth = seen.get(this) || 0;
        if (key !== '') {
          depth++;
        }
        if (depth > maxDepth) {
          return {};
        }
        seen.set(value, depth);
      }
      return value;
    };
  })();
}
