import type { EntityMeta, UserEntity } from '@backstage/catalog-model';
import type { JsonObject, JsonValue } from '@backstage/types';
import { CatalogFiltersV1alpha1 } from './CodemodEntityV1alpha1';

/**
 * Information about a codemod that is stored on a run specification.
 *
 * @public
 */
export type CodemodInfoV1alpha1 = {
  /**
   * The entityRef of the codemod
   */
  entityRef: string;

  /**
   * Where the codemod is stored, so we can resolve relative paths for things like `fetch:template` paths.
   */
  baseUrl?: string;

  /**
   * the Codemod entity
   */
  entity?: {
    /**
     * The metadata of the Codemod
     */
    metadata: EntityMeta;
  };
};

/**
 * @see CodemodInfoV1alpha1
 */
export type CodemodInfo = CodemodInfoV1alpha1;

/**
 * An individual step of a codemod job, as stored in the database.
 *
 * @public
 */
export interface JobStepV1alpha1 {
  /**
   * A unqiue identifier for this step.
   */
  id: string;
  /**
   * A display name to show the user.
   */
  name: string;
  /**
   * The underlying action ID that will be called as part of running this step.
   */
  action: string;
  /**
   * Additional data that will be passed to the action.
   */
  input?: JsonObject;
  /**
   * When this is false, or if the templated value string evaluates to something that is falsy the step will be skipped.
   */
  if?: string | boolean;
}

/**
 * @see JobStepV1alpha1
 */
export type JobStep = JobStepV1alpha1;

/**
 * A codemod run as stored in the database, generated from a v1alpha1
 * apiVersion Codemod.
 *
 * @public
 */
export interface CodemodRunSpecV1alpha1 {
  /**
   * The apiVersion string of the CodemodRunSpec.
   */
  apiVersion: 'codemod.backstage.io/v1alpha1';
  /**
   * A set of catalog filters, defining the targets of the codemod.
   */
  targets: CatalogFiltersV1alpha1;
  /**
   * Set of constraints describing entities on which the codemod can be applied.
   */
  constraints?: CatalogFiltersV1alpha1;
  /**
   * This is a JSONSchema which is used to render a form in the frontend
   * to collect user input and validate it against that schema. This can then be used in the `steps` part below to template
   * variables passed from the user into each action in the codemod.
   */
  parameters: JsonObject;
  /**
   * A list of steps to be executed in sequence which are defined by the codemod. These steps are a list of the underlying
   * javascript action and some optional input parameters that may or may not have been collected from the end user.
   */
  steps: JobStepV1alpha1[];
  /**
   * The output is an object where codemod authors can pull out information from codemod actions and return them in a known standard way.
   */
  output: { [name: string]: JsonValue };
  /**
   * Some information about the codemod itself.
   */
  codemodInfo?: CodemodInfoV1alpha1;
  /**
   * Information on the user who triggered the codemod run.
   */
  user?: {
    /**
     * The user entity from the Catalog
     */
    entity?: UserEntity;
    /**
     * An entity ref for the user
     */
    ref?: string;
  };
}

/**
 * A collection of codemod tasks as stored in the database, generated from a Codemod.
 *
 * @public
 */
export type CodemodRunSpec = CodemodRunSpecV1alpha1;
