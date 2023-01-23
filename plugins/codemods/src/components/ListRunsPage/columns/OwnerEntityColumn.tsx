import React from 'react';
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  EntityPeekAheadPopover,
} from '@backstage/plugin-catalog-react';
import { UserEntity } from '@backstage/catalog-model';

export const OwnerEntityColumn = ({ entityRef }: { entityRef?: string }) => {
  const catalogApi = useApi(catalogApiRef);

  const { value, loading, error } = useAsync(
    () => catalogApi.getEntityByRef(entityRef || ''),
    [catalogApi, entityRef],
  );

  if (!entityRef) {
    return <p>Unknown</p>;
  }

  if (loading || error) {
    return null;
  }

  return (
    <EntityPeekAheadPopover entityRef={entityRef}>
      {(value as UserEntity)?.spec?.profile?.displayName ??
        value?.metadata.name}
    </EntityPeekAheadPopover>
  );
};
