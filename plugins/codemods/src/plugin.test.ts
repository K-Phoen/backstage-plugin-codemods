import { codemodsPlugin } from './plugin';

describe('codemods', () => {
  it('should export plugin', () => {
    expect(codemodsPlugin).toBeDefined();
  });
});
