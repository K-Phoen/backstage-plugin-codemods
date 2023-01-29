import React, { Fragment } from 'react';
import useAsync from 'react-use/lib/useAsync';
import classNames from 'classnames';
import {
  Typography,
  Paper,
  Table,
  TableBody,
  Box,
  Chip,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  makeStyles,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@material-ui/core';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useApi } from '@backstage/core-plugin-api';
import {
  Progress,
  Content,
  Header,
  Page,
  ErrorPage,
  CodeSnippet,
  MarkdownContent,
} from '@backstage/core-components';
import { codemodApiRef } from '../../api';
import { Action, ActionExample } from '../../types';

const useStyles = makeStyles(theme => ({
  code: {
    fontFamily: 'Menlo, monospace',
    padding: theme.spacing(1),
    backgroundColor:
      theme.palette.type === 'dark'
        ? theme.palette.grey[700]
        : theme.palette.grey[300],
    display: 'inline-block',
    borderRadius: 5,
    border: `1px solid ${theme.palette.grey[500]}`,
    position: 'relative',
  },

  codeRequired: {
    '&::after': {
      position: 'absolute',
      content: '"*"',
      top: 0,
      right: theme.spacing(0.5),
      fontWeight: 'bolder',
      color: theme.palette.error.light,
    },
  },

  sidebar: {
    position: 'sticky',
    top: 0,
  },
}));

const ExamplesTable = (props: { examples: ActionExample[] }) => {
  return (
    <Grid container>
      {props.examples.map((example, index) => {
        return (
          <Fragment key={`example-${index}`}>
            <Grid item lg={3}>
              <Box padding={4}>
                <Typography>{example.description}</Typography>
              </Box>
            </Grid>
            <Grid item lg={9}>
              <Box padding={1}>
                <CodeSnippet
                  text={example.example}
                  showLineNumbers
                  showCopyCodeButton
                  language="yaml"
                />
              </Box>
            </Grid>
          </Fragment>
        );
      })}
    </Grid>
  );
};

const ActionsNavigation = ({ actions }: { actions: Action[] }) => {
  const classes = useStyles();

  return (
    <Grid container direction="column" className={classes.sidebar}>
      {actions.map(action => {
        return (
          <Grid item key={`action-summary-${action.id}`} xs={12}>
            <span className={classes.code}>
              <a href={`#${action.id}`}>{action.id}</a>
            </span>
          </Grid>
        );
      })}
    </Grid>
  );
};

export const ActionsPage = () => {
  const api = useApi(codemodApiRef);
  const classes = useStyles();
  const { loading, value, error } = useAsync(async () => {
    return api.listActions();
  });

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return (
      <ErrorPage
        statusMessage="Failed to load installed actions"
        status="500"
      />
    );
  }

  const formatRows = (input: JSONSchema7) => {
    const properties = input.properties;
    if (!properties) {
      return undefined;
    }

    return Object.entries(properties).map(entry => {
      const [key] = entry;
      const props = entry[1] as unknown as JSONSchema7;
      const codeClassname = classNames(classes.code, {
        [classes.codeRequired]: input.required?.includes(key),
      });

      return (
        <TableRow key={key}>
          <TableCell>
            <div className={codeClassname}>{key}</div>
          </TableCell>
          <TableCell>{props.title}</TableCell>
          <TableCell>{props.description}</TableCell>
          <TableCell>
            <>
              {[props.type].flat().map(type => (
                <Chip label={type} key={type} />
              ))}
            </>
          </TableCell>
        </TableRow>
      );
    });
  };

  const renderTable = (input: JSONSchema7) => {
    if (!input.properties) {
      return undefined;
    }
    return (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Type</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{formatRows(input)}</TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderTables = (name: string, input?: JSONSchema7Definition[]) => {
    if (!input) {
      return undefined;
    }

    return (
      <>
        <Typography variant="h6">{name}</Typography>
        {input.map((i, index) => (
          <div key={index}>{renderTable(i as unknown as JSONSchema7)}</div>
        ))}
      </>
    );
  };

  const items = value?.map(action => {
    if (action.id.startsWith('legacy:')) {
      return undefined;
    }

    const oneOf = renderTables('oneOf', action.schema?.input?.oneOf);
    return (
      <Box pb={4} key={action.id}>
        <Typography variant="h4" className={classes.code} id={action.id}>
          {action.id}
        </Typography>
        {action.description && <MarkdownContent content={action.description} />}
        {action.schema?.input && (
          <Box pb={2}>
            <Typography variant="h5">Input</Typography>
            {renderTable(action.schema.input)}
            {oneOf}
          </Box>
        )}
        {action.schema?.output && (
          <Box pb={2}>
            <Typography variant="h5">Output</Typography>
            {renderTable(action.schema.output)}
          </Box>
        )}
        {action.examples && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h5">Examples</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box pb={2}>
                <ExamplesTable examples={action.examples} />
              </Box>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    );
  });

  return (
    <Page themeId="home">
      <Header
        pageTitleOverride="Codemods"
        title="Installed actions"
        subtitle="This is the collection of all installed actions"
      />
      <Content>
        <Grid container direction="row-reverse">
          {value && (
            <Grid item md={4} xl={2} xs={12}>
              <ActionsNavigation actions={value} />
            </Grid>
          )}

          <Grid item md={8} xl={10} xs={12}>
            {items}
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
