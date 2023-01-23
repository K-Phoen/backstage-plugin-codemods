import { isTruthy } from './helper';

describe('isTruthy', () => {
  it.each`
    value        | result
    ${'string'}  | ${true}
    ${true}      | ${true}
    ${1}         | ${true}
    ${['1']}     | ${true}
    ${{}}        | ${true}
    ${false}     | ${false}
    ${''}        | ${false}
    ${undefined} | ${false}
    ${null}      | ${false}
    ${0}         | ${false}
    ${[]}        | ${false}
  `('should be $result for $value', async ({ value, result }) => {
    expect(isTruthy(value)).toEqual(result);
  });
});
