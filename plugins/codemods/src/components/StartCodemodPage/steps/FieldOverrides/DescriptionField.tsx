import React from 'react';
import { MarkdownContent } from '@backstage/core-components';
import { FieldProps } from '@rjsf/core';

export const DescriptionField = ({ description }: FieldProps) =>
  description && <MarkdownContent content={description} linkTarget="_blank" />;
