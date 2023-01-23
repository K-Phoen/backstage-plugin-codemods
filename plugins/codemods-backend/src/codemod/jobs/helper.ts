import { isArray } from 'lodash';

/**
 * Returns true if the input is not `false`, `undefined`, `null`, `""`, `0`, or
 * `[]`. This behavior is based on the behavior of handlebars, see
 * https://handlebarsjs.com/guide/builtin-helpers.html#if
 */
export function isTruthy(value: any): boolean {
  return isArray(value) ? value.length > 0 : !!value;
}
