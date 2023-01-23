import React from 'react';
import { transformSchemaToProps } from './schema';
import { FormProps, IChangeEvent, withTheme } from '@rjsf/core';
import { Theme as MuiTheme } from '@rjsf/material-ui';
import * as fieldOverrides from './FieldOverrides';
import { CodemodParameterSchema } from '../../../types';

const Form = withTheme(MuiTheme);

type Props = {
  schema: CodemodParameterSchema;
  formData: Record<string, any>;

  widgets?: FormProps<any>['widgets'];
  fields?: FormProps<any>['fields'];

  onChange: (e: IChangeEvent) => void;
};

export const CodemodParameters = ({
  schema,
  formData,
  widgets,
  fields,
  onChange,
}: Props) => {
  return (
    <Form
      showErrorList={false}
      widgets={widgets}
      fields={{ ...fieldOverrides, ...fields }}
      noHtml5Validate
      formData={formData}
      formContext={{ formData }}
      onChange={onChange}
      /*
      {...formProps}
      */
      {...transformSchemaToProps(schema)}
    >
      <></>
    </Form>
  );
};
