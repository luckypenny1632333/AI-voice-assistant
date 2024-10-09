/**
 * Define a generic type for the callback
 */
export type UnknownCallback<Input = unknown, Output = unknown> = (
  input: Input,
) => Output;

/**
 * Pipeable function that performs a tap on the provided function and returns the arguments passed to it.
 * Can be used for logging or debugging purposes in promise chains.
 * @param callback
 * @returns
 */
export const pTap =
  <P, R>(callback: UnknownCallback<P, R>): UnknownCallback<P, P> =>
  (args: P): P => {
    callback(args);
    return args;
  };
