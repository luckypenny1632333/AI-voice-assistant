/**
 * Throws an error indicating that a code path that should never be reached has been reached.
 *
 * @param {never} x The value that was passed to the function. This value should never be possible.
 * @throws {Error} An error with the message "assertUnreachable:" followed by the value of `x`.
 * @returns {never} This function never returns, as it always throws an error.
 */
export function assertUnreachable(x: never): never {
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  throw new Error(`assertUnreachable:${x}`);
}
