import { CodemodEntityV1alpha1 } from '@k-phoen/plugin-codemods-common';
import { CodemodEntitiesProcessor } from './CodemodEntitiesProcessor';

const mockLocation = { type: 'a', target: 'b' };
const mockEntity: CodemodEntityV1alpha1 = {
  apiVersion: 'codemod.backstage.io/v1alpha1',
  kind: 'Codemod',
  metadata: { name: 'n' },
  spec: {
    owner: 'o',
    steps: [],
  },
};

describe('CodemodEntitiesProcessor', () => {
  describe('validateEntityKind', () => {
    it('validates the entity kind', async () => {
      const processor = new CodemodEntitiesProcessor();

      await expect(processor.validateEntityKind(mockEntity)).resolves.toBe(
        true,
      );
      await expect(
        processor.validateEntityKind({
          ...mockEntity,
          apiVersion: 'backstage.io/v1beta3',
        }),
      ).resolves.toBe(false);
      await expect(
        processor.validateEntityKind({ ...mockEntity, kind: 'Component' }),
      ).resolves.toBe(false);
    });
  });

  describe('postProcessEntity', () => {
    it('generates relations for component entities', async () => {
      const processor = new CodemodEntitiesProcessor();

      const emit = jest.fn();

      await processor.postProcessEntity(mockEntity, mockLocation, emit);

      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit).toHaveBeenCalledWith({
        type: 'relation',
        relation: {
          source: { kind: 'Group', namespace: 'default', name: 'o' },
          type: 'ownerOf',
          target: { kind: 'Codemod', namespace: 'default', name: 'n' },
        },
      });
      expect(emit).toHaveBeenCalledWith({
        type: 'relation',
        relation: {
          source: { kind: 'Codemod', namespace: 'default', name: 'n' },
          type: 'ownedBy',
          target: { kind: 'Group', namespace: 'default', name: 'o' },
        },
      });
    });
  });
});
