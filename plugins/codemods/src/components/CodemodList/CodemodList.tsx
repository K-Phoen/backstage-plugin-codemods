import React, { ComponentType } from 'react';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import {
  Content,
  ContentHeader,
  ItemCardGrid,
  Link,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import { useEntityList } from '@backstage/plugin-catalog-react';
import { Typography } from '@material-ui/core';
import { CodemodCard } from '../CodemodCard';
import { CodemodEntityV1alpha1 } from '@k-phoen/plugin-codemods-common';

/**
 * @internal
 */
export type CodemodListProps = {
  CodemodCardComponent?:
    | ComponentType<{ codemod: CodemodEntityV1alpha1 }>
    | undefined;
  group?: {
    title?: React.ReactNode;
    filter: (entity: Entity) => boolean;
  };
};

/**
 * @internal
 */
export const CodemodList = ({
  CodemodCardComponent,
  group,
}: CodemodListProps) => {
  const { loading, error, entities } = useEntityList();
  const Card = CodemodCardComponent || CodemodCard;
  const maybeFilteredEntities = group
    ? entities.filter(e => group.filter(e))
    : entities;

  const titleComponent: React.ReactNode = (() => {
    if (group && group.title) {
      if (typeof group.title === 'string') {
        return <ContentHeader title={group.title} />;
      }
      return group.title;
    }

    return <ContentHeader title="Other Codemods" />;
  })();

  if (group && maybeFilteredEntities.length === 0) {
    return null;
  }
  return (
    <>
      {loading && <Progress />}

      {error && (
        <WarningPanel title="Oops! Something went wrong loading the codemods">
          {error.message}
        </WarningPanel>
      )}

      {!error && !loading && !entities.length && (
        <Typography variant="body2">
          No Codemod found that match your filter. Learn more about{' '}
          <Link to="https://backstage.io/docs/features/software-codemods/adding-codemods">
            adding codemods
          </Link>
          .
        </Typography>
      )}

      <Content>
        {titleComponent}
        <ItemCardGrid>
          {maybeFilteredEntities &&
            maybeFilteredEntities?.length > 0 &&
            maybeFilteredEntities.map((codemod: Entity) => (
              <Card
                key={stringifyEntityRef(codemod)}
                codemod={codemod as CodemodEntityV1alpha1}
              />
            ))}
        </ItemCardGrid>
      </Content>
    </>
  );
};
