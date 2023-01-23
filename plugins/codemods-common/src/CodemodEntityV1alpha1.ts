import {
  Entity,
  entityKindSchemaValidator,
  KindValidator,
} from '@backstage/catalog-model';
import { JsonObject } from '@backstage/types';
import schema from './Codemod.v1alpha1.schema.json';

export type ConstraintsQueryV1alpha1 = Record<string, string | string[]>;

export type ConstraintsQuery = ConstraintsQueryV1alpha1;

/**
 * Backstage catalog Codemod kind Entity. Codemods are used by the Codemod
 * plugin to programatically update entities.
 *
 * @public
 */
export interface CodemodEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the TaskSpec.
   */
  apiVersion: 'codemod.backstage.io/v1alpha1';

  /**
   * The kind of the entity
   */
  kind: 'Codemod';

  /**
   * The specification of the Codemod Entity
   */
  spec: {
    /**
     * Text explaining what the codemod does and how it should be used. Only used by the frontend to guide codemod users.
     */
    details?: string;

    /**
     * The owner entityRef of the CodemodEntity
     */
    owner?: string;

    /**
     * Set of constraints describing entities on which the codemod can be applied.
     */
    constraints?: ConstraintsQueryV1alpha1;

    /**
     * This is a JSONSchema or an array of JSONSchema's which is used to render a form in the frontend
     * to collect user input and validate it against that schema. This can then be used in the `steps` part below to template
     * variables passed from the user into each action in the codemod.
     */
    parameters?: JsonObject;

    /**
     * A list of steps to be executed in sequence which are defined by the codemod. These steps are a list of the underlying
     * javascript action and some optional input parameters that may or may not have been collected from the end user.
     */
    steps: Array<{
      id?: string;
      name?: string;
      action: string;
      input?: JsonObject;
      if?: string | boolean;
    }>;

    /**
     * The output is an object where codemod authors can pull out information from actions and return them in a known standard way.
     */
    output?: { [name: string]: string };
  };
}

export type CodemodEntity = CodemodEntityV1alpha1;

const validator = entityKindSchemaValidator(schema);

/**
 * Entity data validator for {@link CodemodEntityV1alpha1}.
 *
 * @public
 */
export const codemodEntityV1alpha1Validator: KindValidator = {
  async check(data: Entity) {
    return validator(data) === data;
  },
};
