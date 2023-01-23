import React from 'react';
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { createStyles, makeStyles } from '@material-ui/core';
import {
  catalogApiRef,
  EntityPeekAheadPopover,
} from '@backstage/plugin-catalog-react';

const useStyles = makeStyles(() =>
  createStyles({
    refTitle: {
      textDecoration: 'underline dotted',
    },
  }),
);

export const CodemodEntityRef = ({ entityRef }: { entityRef: string }) => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);
  const { value, loading, error } = useAsync(
    () => catalogApi.getEntityByRef(entityRef),
    [catalogApi, entityRef],
  );

  if (loading || error || !entityRef) {
    return null;
  }

  return (
    <EntityPeekAheadPopover entityRef={entityRef}>
      <span className={classes.refTitle}>
        {value?.metadata?.title || entityRef}
      </span>
    </EntityPeekAheadPopover>
  );
};
