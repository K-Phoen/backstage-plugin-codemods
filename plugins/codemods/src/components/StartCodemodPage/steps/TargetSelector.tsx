import React from 'react';
import { Typography } from '@material-ui/core';
import {
  Content,
  Progress,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import {
  CatalogFilterLayout,
  EntityTable,
} from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { EntityKindPicker } from '../../EntityKindPicker';
import { useEntityList } from '../../hooks/useEntityListProvider';
import { StaticFacetPicker } from '../../StaticFacetPicker';

const defaultColumns: TableColumn<Entity>[] = [
  EntityTable.columns.createEntityRefColumn({ defaultKind: 'component' }),
  EntityTable.columns.createSystemColumn(),
  EntityTable.columns.createOwnerColumn(),
  EntityTable.columns.createSpecTypeColumn(),
  EntityTable.columns.createSpecLifecycleColumn(),
  EntityTable.columns.createMetadataDescriptionColumn(),
];

const TargetList = () => {
  const { loading, error, entities } = useEntityList();

  return (
    <>
      {loading && <Progress />}

      {error && (
        <WarningPanel title="Oops! Something went wrong loading the catalog">
          {error.message}
        </WarningPanel>
      )}

      {!error && !loading && !entities.length && (
        <Typography variant="body2">
          No entities found that match your filter.
        </Typography>
      )}

      <Content>
        <EntityTable
          title="Selected targets"
          entities={entities}
          columns={defaultColumns}
        />
      </Content>
    </>
  );
};

export const TargetSelector = () => {
  return (
    <CatalogFilterLayout>
      <CatalogFilterLayout.Filters>
        <EntityKindPicker />
        <StaticFacetPicker
          label="Type"
          facetName="spec.type"
          filterName="type"
        />
        <StaticFacetPicker
          label="Owner"
          facetName="spec.owner"
          filterName="owners"
        />
        <StaticFacetPicker
          label="Lifecycle"
          facetName="spec.lifecycle"
          filterName="lifecycles"
        />
      </CatalogFilterLayout.Filters>

      <CatalogFilterLayout.Content>
        <TargetList />
      </CatalogFilterLayout.Content>
    </CatalogFilterLayout>
  );
};
