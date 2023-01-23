import React from 'react';
import { Grid, LinkProps, makeStyles, Typography } from '@material-ui/core';
import LanguageIcon from '@material-ui/icons/Language';

import { IconComponent } from '@backstage/core-plugin-api';
import { Link } from '@backstage/core-components';

const useStyles = makeStyles({
  svgIcon: {
    display: 'inline-block',
    '& svg': {
      display: 'inline-block',
      fontSize: 'inherit',
      verticalAlign: 'baseline',
    },
  },
});

export const IconLink = (
  props: {
    href: string;
    text?: string;
    Icon?: IconComponent;
  } & LinkProps,
) => {
  const { href, text, Icon, ...linkProps } = props;

  const classes = useStyles();

  return (
    <Grid container direction="row" spacing={1}>
      <Grid item>
        <Typography component="div" className={classes.svgIcon}>
          {Icon ? <Icon /> : <LanguageIcon />}
        </Typography>
      </Grid>
      <Grid item>
        <Link to={href} {...linkProps}>
          {text || href}
        </Link>
      </Grid>
    </Grid>
  );
};
