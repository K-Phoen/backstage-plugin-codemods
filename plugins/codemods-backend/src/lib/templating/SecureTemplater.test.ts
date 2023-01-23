import { SecureTemplater } from './SecureTemplater';

describe('SecureTemplater', () => {
  it('should render some templates', async () => {
    const render = await SecureTemplater.loadRenderer();
    expect(render('${{ test }}', { test: 'my-value' })).toBe('my-value');

    expect(render('${{ test | dump }}', { test: 'my-value' })).toBe(
      '"my-value"',
    );

    expect(
      render('${{ test | replace("my-", "our-") }}', {
        test: 'my-value',
      }),
    ).toBe('our-value');

    expect(() =>
      render('${{ invalid...syntax }}', {
        test: 'my-value',
      }),
    ).toThrow(/expected name as lookup value, got ./);
  });

  it('should make additional filters available when requested', async () => {
    const mockFilter1 = jest.fn(() => 'filtered text');
    const mockFilter2 = jest.fn((var1, var2) => `${var1} ${var2}`);
    const mockFilter3 = jest.fn((var1, var2) => ({ var1, var2 }));
    const renderWith = await SecureTemplater.loadRenderer({
      additionalTemplateFilters: { mockFilter1, mockFilter2, mockFilter3 },
    });
    const renderWithout = await SecureTemplater.loadRenderer();

    const ctx = { inputValue: 'the input value' };

    expect(renderWith('${{ inputValue | mockFilter1 }}', ctx)).toBe(
      'filtered text',
    );
    expect(
      renderWith('${{ inputValue | mockFilter2("extra arg") }}', ctx),
    ).toBe('the input value extra arg');
    expect(
      renderWith(
        '${{ inputValue | mockFilter3("another extra arg") | dump }}',
        ctx,
      ),
    ).toBe(
      JSON.stringify({
        var1: 'the input value',
        var2: 'another extra arg',
      }),
    );

    expect(() => renderWithout('${{ inputValue | mockFilter1 }}', ctx)).toThrow(
      /Error: filter not found: mockFilter1/,
    );
    expect(() =>
      renderWithout('${{ inputValue | mockFilter2("extra arg") }}', ctx),
    ).toThrow(/Error: filter not found: mockFilter2/);
    expect(() =>
      renderWithout('${{ inputValue | mockFilter3("extra arg") }}', ctx),
    ).toThrow(/Error: filter not found: mockFilter3/);

    expect(mockFilter1.mock.calls).toEqual([['the input value']]);
    expect(mockFilter2.mock.calls).toEqual([['the input value', 'extra arg']]);
    expect(mockFilter3.mock.calls).toEqual([
      ['the input value', 'another extra arg'],
    ]);
  });

  it('should make additional globals available when requested', async () => {
    const mockGlobal1 = jest.fn(() => 'awesome global function');
    const mockGlobal2 = 'foo';
    const mockGlobal3 = 123456;
    const renderWith = await SecureTemplater.loadRenderer({
      additionalTemplateGlobals: { mockGlobal1, mockGlobal2, mockGlobal3 },
    });
    const renderWithout = await SecureTemplater.loadRenderer();

    const ctx = {};

    expect(renderWith('${{ mockGlobal1() }}', ctx)).toBe(
      'awesome global function',
    );
    expect(renderWith('${{ mockGlobal2 }}', ctx)).toBe('foo');
    expect(renderWith('${{ mockGlobal3 }}', ctx)).toBe('123456');

    expect(() => renderWithout('${{ mockGlobal1() }}', ctx)).toThrow(
      /Error: Unable to call `mockGlobal1`/,
    );
  });

  it('allows pollution during a single template execution', async () => {
    const render = await SecureTemplater.loadRenderer();

    const ctx = {
      x: 'foo',
    };
    expect(render('${{ x }}', ctx)).toBe('foo');
    expect(
      render(
        '${{ ({}).constructor.constructor("Array.prototype.forEach = () => {}")() }}',
        ctx,
      ),
    ).toBe('');
    expect(() => render('${{ x }}', ctx)).toThrow();
  });
});
