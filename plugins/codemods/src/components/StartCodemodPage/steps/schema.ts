import { JsonObject } from '@backstage/types';
import { FormProps, UiSchema } from '@rjsf/core';

const isObject = (value: unknown): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const extractUiSchema = (schema: JsonObject, uiSchema: JsonObject) => {
  if (!isObject(schema)) {
    return;
  }

  const { properties, items, anyOf, oneOf, allOf, dependencies } = schema;

  for (const propName in schema) {
    if (!schema.hasOwnProperty(propName)) {
      continue;
    }

    if (propName.startsWith('ui:')) {
      uiSchema[propName] = schema[propName];
      delete schema[propName];
    }
  }

  if (isObject(properties)) {
    for (const propName in properties) {
      if (!properties.hasOwnProperty(propName)) {
        continue;
      }

      const schemaNode = properties[propName];
      if (!isObject(schemaNode)) {
        continue;
      }
      const innerUiSchema = {};
      uiSchema[propName] = uiSchema[propName] || innerUiSchema;
      extractUiSchema(schemaNode, innerUiSchema);
    }
  }

  if (isObject(items)) {
    const innerUiSchema = {};
    uiSchema.items = innerUiSchema;
    extractUiSchema(items, innerUiSchema);
  }

  if (Array.isArray(anyOf)) {
    for (const schemaNode of anyOf) {
      if (!isObject(schemaNode)) {
        continue;
      }
      extractUiSchema(schemaNode, uiSchema);
    }
  }

  if (Array.isArray(oneOf)) {
    for (const schemaNode of oneOf) {
      if (!isObject(schemaNode)) {
        continue;
      }
      extractUiSchema(schemaNode, uiSchema);
    }
  }

  if (Array.isArray(allOf)) {
    for (const schemaNode of allOf) {
      if (!isObject(schemaNode)) {
        continue;
      }
      extractUiSchema(schemaNode, uiSchema);
    }
  }

  if (isObject(dependencies)) {
    for (const depName of Object.keys(dependencies)) {
      const schemaNode = dependencies[depName];
      if (!isObject(schemaNode)) {
        continue;
      }
      extractUiSchema(schemaNode, uiSchema);
    }
  }
};

export function transformSchemaToProps(inputSchema: JsonObject): {
  schema: FormProps<any>['schema'];
  uiSchema: FormProps<any>['uiSchema'];
} {
  inputSchema.type = inputSchema.type || 'object';
  const schema = JSON.parse(JSON.stringify(inputSchema));
  const uiSchema: UiSchema = {};
  extractUiSchema(schema, uiSchema);

  return { schema, uiSchema };
}
