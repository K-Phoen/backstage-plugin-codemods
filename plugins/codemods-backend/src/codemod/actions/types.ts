import { Schema } from 'jsonschema';
import { Logger } from 'winston';
import { Writable } from 'stream';
import { JsonValue, JsonObject } from '@backstage/types';
import { Entity, UserEntity } from '@backstage/catalog-model';
import { CodemodInfo } from '@k-phoen/plugin-codemods-common';

/**
 * ActionContext is passed into codemod actions.
 * @public
 */
export type ActionContext<Input extends JsonObject> = {
  logger: Logger;
  logStream: Writable;
  workspacePath: string;
  input: Input;

  codemodInfo?: CodemodInfo;

  /**
   * Catalog entity targeted by the codemod run.
   */
  target: {
    entity: Entity;
    ref: string;
  };

  /**
   * The user which triggered the action.
   */
  user?: {
    /**
     * The decorated entity from the Catalog
     */
    entity?: UserEntity;
    /**
     * An entity ref for the author of the task
     */
    ref?: string;
  };

  output(name: string, value: JsonValue): void;

  /**
   * Creates a temporary directory for use by the action, which is then cleaned up automatically.
   */
  createTemporaryDirectory(): Promise<string>;
};

/** @public */
export type CodemodAction<Input extends JsonObject> = {
  /**
   * Identifier of the action.
   */
  id: string;

  /**
   * Human-readable description of what the action does.
   */
  description?: string;

  /**
   * Examples documenting the action's usage.
   */
  examples?: {
    /**
     * Brief explanation of what the example is showing.
     */
    description: string;

    /**
     * Actual code of the example (in YAML).
     */
    example: string;
  }[];

  /**
   * Schema describing the inputs/outputs of the action.
   */
  schema?: {
    input?: Schema;
    output?: Schema;
  };

  handler: (ctx: ActionContext<Input>) => Promise<void>;
};
