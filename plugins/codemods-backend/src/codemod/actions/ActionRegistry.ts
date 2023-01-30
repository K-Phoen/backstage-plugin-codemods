import { JsonObject } from '@backstage/types';
import { ConflictError, NotFoundError } from '@backstage/errors';
import { CodemodAction } from './types';

/**
 * Registry of all registered codemod actions.
 * @public
 */
export class ActionRegistry {
  private readonly actions = new Map<string, CodemodAction<any>>();

  static create(actions: CodemodAction<any>[]): ActionRegistry {
    const registry = new ActionRegistry();
    actions.forEach(action => registry.register(action));

    return registry;
  }

  register<TInput extends JsonObject>(action: CodemodAction<TInput>) {
    if (this.actions.has(action.id)) {
      throw new ConflictError(
        `Codemod action with ID '${action.id}' has already been registered`,
      );
    }
    this.actions.set(action.id, action);
  }

  get(actionId: string): CodemodAction<JsonObject> {
    const action = this.actions.get(actionId);
    if (!action) {
      throw new NotFoundError(
        `Codemod action with ID '${actionId}' is not registered.`,
      );
    }
    return action;
  }

  list(): CodemodAction<JsonObject>[] {
    return [...this.actions.values()];
  }
}
