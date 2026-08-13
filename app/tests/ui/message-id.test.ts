import { describe, expect, it } from 'vitest';

import { isNonNegativeSafeMessageId } from '../../src/ERA变量框架/ui/utils/message-id';

describe('ERA UI message ID boundary', () => {
  it.each([0, 1, Number.MAX_SAFE_INTEGER])('accepts non-negative safe integer %s', value => {
    expect(isNonNegativeSafeMessageId(value)).toBe(true);
  });

  it.each([
    null,
    undefined,
    '',
    '0',
    '1.5',
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid runtime value %s', value => {
    expect(isNonNegativeSafeMessageId(value)).toBe(false);
  });
});
