import {
  Content,
  ContentHeader,
  Header,
  Page,
  SupportButton,
} from '@backstage/core-components';
import { Entity } from '@backstage/catalog-model';
import {
  CatalogFilterLayout,
  EntityKindPicker,
  EntityListProvider,
  EntitySearchBar,
  EntityTagPicker,
  UserListPicker,
} from '@backstage/plugin-catalog-react';
import { CodemodEntityV1alpha1 } from '@k-phoen/plugin-codemods-common';
import React, { ComponentType } from 'react';
import { CodemodList } from '../CodemodList';
import {
  CodemodContextMenu,
  CodemodContextMenuProps,
} from '../CodemodContextMenu';

export type CodemodPageProps = {
  CodemodCardComponent?:
    | ComponentType<{ codemod: CodemodEntityV1alpha1 }>
    | undefined;
  groups?: Array<{
    title?: React.ReactNode;
    filter: (entity: Entity) => boolean;
  }>;
  headerOptions?: {
    pageTitleOverride?: string;
    title?: string;
    subtitle?: string;
  };
  contextMenu?: CodemodContextMenuProps;
};

export const CodemodPageContents = ({
  CodemodCardComponent,
  groups,
  contextMenu,
  headerOptions,
}: CodemodPageProps) => {
  const otherCodemodsGroup = {
    title: groups ? 'Other codemods' : 'Codemods',
    filter: (entity: Entity) => {
      const filtered = (groups ?? []).map(group => group.filter(entity));
      return !filtered.some(result => result === true);
    },
  };

  return (
    <Page themeId="home">
      <Header
        pageTitleOverride="Apply a codemod"
        title="Apply a codemod"
        subtitle="Patch software components using standard codemods"
        {...headerOptions}
      >
        <CodemodContextMenu {...contextMenu} />
      </Header>
      <Content>
        <ContentHeader title="Available Codemods">
          <SupportButton>
            Patch software components using standard codemods.
          </SupportButton>
        </ContentHeader>

        <CatalogFilterLayout>
          <CatalogFilterLayout.Filters>
            <EntitySearchBar />
            <EntityKindPicker initialFilter="codemod" hidden />
            <UserListPicker
              initialFilter="all"
              availableFilters={['all', 'starred']}
            />
            <EntityTagPicker />
          </CatalogFilterLayout.Filters>
          <CatalogFilterLayout.Content>
            {groups &&
              groups.map((group, index) => (
                <CodemodList
                  key={index}
                  CodemodCardComponent={CodemodCardComponent}
                  group={group}
                />
              ))}
            <CodemodList
              key="other"
              CodemodCardComponent={CodemodCardComponent}
              group={otherCodemodsGroup}
            />
          </CatalogFilterLayout.Content>
        </CatalogFilterLayout>
      </Content>
    </Page>
  );
};

export const CodemodPage = ({
  CodemodCardComponent,
  groups,
  contextMenu,
  headerOptions,
}: CodemodPageProps) => (
  <EntityListProvider>
    <CodemodPageContents
      CodemodCardComponent={CodemodCardComponent}
      groups={groups}
      contextMenu={contextMenu}
      headerOptions={headerOptions}
    />
  </EntityListProvider>
);
