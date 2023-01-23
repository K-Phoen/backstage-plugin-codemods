import {
  Entity,
  EntityLink,
  parseEntityRef,
  RELATION_OWNED_BY,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import {
  Button,
  ItemCardHeader,
  MarkdownContent,
} from '@backstage/core-components';
import {
  IconComponent,
  useApi,
  useApp,
  useRouteRef,
} from '@backstage/core-plugin-api';
import {
  ScmIntegrationIcon,
  scmIntegrationsApiRef,
} from '@backstage/integration-react';
import {
  EntityRefLinks,
  FavoriteEntity,
  getEntityRelations,
  getEntitySourceLocation,
} from '@backstage/plugin-catalog-react';
import { CodemodEntityV1alpha1 } from '@k-phoen/plugin-codemods-common';
import { BackstageTheme } from '@backstage/theme';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  makeStyles,
  Tooltip,
  Typography,
  useTheme,
} from '@material-ui/core';
import LanguageIcon from '@material-ui/icons/Language';
import React from 'react';
import { selectedCodemodRouteRef } from '../../routes';

const useStyles = makeStyles(theme => ({
  cardHeader: {
    position: 'relative',
  },
  title: {
    backgroundImage: ({ backgroundImage }: any) => backgroundImage,
  },
  box: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    '-webkit-line-clamp': 10,
    '-webkit-box-orient': 'vertical',
  },
  label: {
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    lineHeight: 1,
    paddingBottom: '0.2rem',
  },
  linksLabel: {
    padding: '0 16px',
  },
  description: {
    '& p': {
      margin: '0px',
    },
  },
  leftButton: {
    marginRight: 'auto',
  },
  starButton: {
    position: 'absolute',
    top: theme.spacing(0.5),
    right: theme.spacing(0.5),
    padding: '0.25rem',
    color: '#fff',
  },
}));

const MuiIcon = ({ icon: Icon }: { icon: IconComponent }) => <Icon />;

export type CodemodCardProps = {
  codemod: CodemodEntityV1alpha1;
};

type CodemodProps = {
  description: string;
  tags: string[];
  title: string;
  name: string;
  links: EntityLink[];
};

const getCodemodCardProps = (
  codemod: CodemodEntityV1alpha1,
): CodemodProps & { key: string } => {
  return {
    key: codemod.metadata.uid!,
    name: codemod.metadata.name,
    title: `${(codemod.metadata.title || codemod.metadata.name) ?? ''}`,
    description: codemod.metadata.description ?? '-',
    tags: (codemod.metadata?.tags as string[]) ?? [],
    links: codemod.metadata.links ?? [],
  };
};

export const CodemodCard = ({ codemod }: CodemodCardProps) => {
  const app = useApp();
  const backstageTheme = useTheme<BackstageTheme>();
  const codemodRoute = useRouteRef(selectedCodemodRouteRef);
  const codemodProps = getCodemodCardProps(codemod);
  const ownedByRelations = getEntityRelations(
    codemod as Entity,
    RELATION_OWNED_BY,
  );
  const theme = backstageTheme.getPageTheme({ themeId: 'tool' });
  const classes = useStyles({ backgroundImage: theme.backgroundImage });
  const { name, namespace } = parseEntityRef(stringifyEntityRef(codemod));
  const href = codemodRoute({ codemodName: name, namespace });

  const iconResolver = (key?: string): IconComponent =>
    key ? app.getSystemIcon(key) ?? LanguageIcon : LanguageIcon;

  const scmIntegrationsApi = useApi(scmIntegrationsApiRef);
  const sourceLocation = getEntitySourceLocation(codemod, scmIntegrationsApi);

  return (
    <Card>
      <CardMedia className={classes.cardHeader}>
        <FavoriteEntity className={classes.starButton} entity={codemod} />
        <ItemCardHeader
          title={codemodProps.title}
          classes={{ root: classes.title }}
        />
      </CardMedia>
      <CardContent
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <Box className={classes.box}>
          <Typography variant="body2" className={classes.label}>
            Description
          </Typography>
          <MarkdownContent
            className={classes.description}
            content={codemodProps.description}
          />
        </Box>
        <Box className={classes.box}>
          <Typography variant="body2" className={classes.label}>
            Owner
          </Typography>
          <EntityRefLinks entityRefs={ownedByRelations} defaultKind="Group" />
        </Box>
        <Box>
          <Typography
            style={{ marginBottom: '4px' }}
            variant="body2"
            className={classes.label}
          >
            Tags
          </Typography>
          {codemodProps.tags?.map(tag => (
            <Chip size="small" label={tag} key={tag} />
          ))}
        </Box>
      </CardContent>
      <Typography
        variant="body2"
        className={[classes.label, classes.linksLabel].join(' ')}
      >
        Links
      </Typography>
      <CardActions>
        <div className={classes.leftButton}>
          {sourceLocation && (
            <Tooltip
              title={
                sourceLocation.integrationType ||
                sourceLocation.locationTargetUrl
              }
            >
              <IconButton
                className={classes.leftButton}
                href={sourceLocation.locationTargetUrl}
              >
                <ScmIntegrationIcon type={sourceLocation.integrationType} />
              </IconButton>
            </Tooltip>
          )}
          {codemodProps.links?.map((link, i) => (
            <Tooltip key={`${link.url}_${i}`} title={link.title || link.url}>
              <IconButton size="medium" href={link.url}>
                <MuiIcon icon={iconResolver(link.icon)} />
              </IconButton>
            </Tooltip>
          ))}
        </div>
        <Button
          color="primary"
          to={href}
          aria-label={`Choose ${codemodProps.title}`}
        >
          Choose
        </Button>
      </CardActions>
    </Card>
  );
};
