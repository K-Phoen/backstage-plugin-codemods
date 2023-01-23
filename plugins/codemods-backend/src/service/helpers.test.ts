import { ConstraintsQuery } from '@k-phoen/plugin-codemods-common';
import { constrainTargets } from './helpers';

describe('constrainTargets', () => {
  it('leaves unconstrained targets untouched', async () => {
    const targets: ConstraintsQuery = {
      kind: ['Component', 'API'],
      'spec.type': ['service', 'grpc'],
    };
    const constraints = {};

    expect(constrainTargets(targets, constraints)).toEqual(targets);
  });

  it('constrains fields present both in targets and constraints lists', async () => {
    const targets: ConstraintsQuery = {
      kind: ['Component', 'API'],
      'spec.type': ['service', 'grpc'],
      'spec.lifecycle': ['production'],
    };
    const constraints: ConstraintsQuery = {
      kind: ['Component'],
      'spec.type': ['service'],
    };
    const expected = {
      kind: ['Component'],
      'spec.type': ['service'],
      'spec.lifecycle': ['production'],
    };

    expect(constrainTargets(targets, constraints)).toEqual(expected);
  });

  it('works with a more complex example', async () => {
    const targets: ConstraintsQuery = {
      kind: ['Component', 'Resource'],
      'spec.type': ['service', 'library', 'database'],
      'spec.lifecycle': ['production'],
      'spec.owner': ['team-a', 'team-b'],
    };
    const constraints: ConstraintsQuery = {
      kind: ['Component', 'API'],
      'spec.type': ['service', 'library', 'grpc', 'openapi'],
      'spec.tier': ['tier-1', 'tier-2', 'tier-3'],
    };
    const expected = {
      kind: ['Component'],
      'spec.type': ['service', 'library'],
      'spec.lifecycle': ['production'],
      'spec.owner': ['team-a', 'team-b'],
      'spec.tier': ['tier-1', 'tier-2', 'tier-3'],
    };

    expect(constrainTargets(targets, constraints)).toEqual(expected);
  });
});
