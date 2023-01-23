import { CodemodSpecV1alpha1 } from './CodemodRunSpec';

/**
 * A job as stored in the database, generated from a v1alpha1
 * apiVersion Codemod.
 *
 * @public
 */
export interface JobSpecV1alpha1 {
  /**
   * The codemod to apply.
   */
  codemod: CodemodSpecV1alpha1;
  /**
   * An entity ref to the catalog entity on which to apply the codemod.
   */
  targetRef: string;
}

/**
 * A codemod task as stored in the database, generated from a Codemod.
 *
 * @public
 */
export type JobSpec = JobSpecV1alpha1;
