import { entityKindSchemaValidator } from '@backstage/catalog-model';
import type { CodemodEntityV1alpha1 } from './CodemodEntityV1alpha1';
import schema from './Codemod.v1alpha1.schema.json';

const validator = entityKindSchemaValidator(schema);

describe('codemodEntityV1alpha1Validator', () => {
  let entity: CodemodEntityV1alpha1;

  beforeEach(() => {
    entity = {
      apiVersion: 'codemod.backstage.io/v1alpha1',
      kind: 'Codemod',
      metadata: {
        name: 'test',
      },
      spec: {
        owner: 'team-b',
        steps: [],
      },
    };
  });

  it('happy path: accepts valid data', async () => {
    expect(validator(entity)).toBe(entity);
  });

  it('ignores unknown apiVersion', async () => {
    (entity as any).apiVersion = 'backstage.io/v1beta0';
    expect(validator(entity)).toBe(false);
  });

  it('ignores unknown kind', async () => {
    (entity as any).kind = 'Wizard';
    expect(validator(entity)).toBe(false);
  });
});
