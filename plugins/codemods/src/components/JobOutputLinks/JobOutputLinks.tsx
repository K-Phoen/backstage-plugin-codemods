import React from 'react';
import { parseEntityRef } from '@backstage/catalog-model';
import { IconComponent, useApp, useRouteRef } from '@backstage/core-plugin-api';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import { Box } from '@material-ui/core';
import LanguageIcon from '@material-ui/icons/Language';
import { JobOutput } from '../../types';
import { IconLink } from './IconLink';

type TaskPageLinksProps = {
  output: JobOutput;
};

export const JobOutputLinks = ({ output }: TaskPageLinksProps) => {
  const { links = [] } = output;
  const app = useApp();
  const entityRoute = useRouteRef(entityRouteRef);

  const iconResolver = (key?: string): IconComponent =>
    key ? app.getSystemIcon(key) ?? LanguageIcon : LanguageIcon;

  return (
    <Box px={3} pb={3}>
      {links
        .filter(({ url, entityRef }) => url || entityRef)
        .map(({ url, entityRef, text, icon }) => {
          if (entityRef) {
            const entityName = parseEntityRef(entityRef, {
              defaultKind: '<unknown>',
              defaultNamespace: '<unknown>',
            });
            const target = entityRoute(entityName);
            return { text, icon, url: target };
          }
          return { text, icon, url: url! };
        })
        .map(({ url, text, icon }, i) => (
          <IconLink
            key={`output-link-${i}`}
            href={url}
            text={text ?? url}
            Icon={iconResolver(icon)}
            target="_blank"
          />
        ))}
    </Box>
  );
};
