import React from 'react';
import { FormProps, IChangeEvent, withTheme } from '@rjsf/core';
import { Theme as MuiTheme } from '@rjsf/material-ui';
import { CodemodEntityV1alpha1 } from '@k-phoen/plugin-codemods-common';
import { transformSchemaToProps } from './schema';
import * as fieldOverrides from './FieldOverrides';

const Form = withTheme(MuiTheme);

type Props = {
  codemod: CodemodEntityV1alpha1;
  formData: Record<string, any>;

  widgets?: FormProps<any>['widgets'];
  fields?: FormProps<any>['fields'];

  onChange: (e: IChangeEvent) => void;
};

export const CodemodParameters = ({
  codemod,
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
      {...transformSchemaToProps(codemod.spec.parameters || {})}
    >
      <></>
    </Form>
  );
};
