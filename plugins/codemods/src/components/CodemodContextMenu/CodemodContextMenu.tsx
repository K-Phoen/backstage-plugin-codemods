import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRouteRef } from '@backstage/core-plugin-api';
import IconButton from '@material-ui/core/IconButton';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import MenuItem from '@material-ui/core/MenuItem';
import MenuList from '@material-ui/core/MenuList';
import Popover from '@material-ui/core/Popover';
import { makeStyles } from '@material-ui/core/styles';
import Description from '@material-ui/icons/Description';
import List from '@material-ui/icons/List';
import MoreVert from '@material-ui/icons/MoreVert';
import { actionsRouteRef, codemodListRunsRouteRef } from '../../routes';

const useStyles = makeStyles({
  button: {
    color: 'white',
  },
});

export type CodemodContextMenuProps = {
  actions?: boolean;
  runs?: boolean;
};

export function CodemodContextMenu(props: CodemodContextMenuProps) {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement>();
  const actionsLink = useRouteRef(actionsRouteRef);
  const runsLink = useRouteRef(codemodListRunsRouteRef);

  const navigate = useNavigate();

  const showActions = props.actions !== false;
  const showRuns = props.runs !== false;

  if (!showRuns && !showActions) {
    return null;
  }

  const onOpen = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const onClose = () => {
    setAnchorEl(undefined);
  };

  return (
    <>
      <IconButton
        aria-label="more"
        aria-controls="long-menu"
        aria-haspopup="true"
        onClick={onOpen}
        data-testid="menu-button"
        color="inherit"
        className={classes.button}
      >
        <MoreVert />
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        onClose={onClose}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuList>
          {showActions && (
            <MenuItem onClick={() => navigate(actionsLink())}>
              <ListItemIcon>
                <Description fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Installed Actions" />
            </MenuItem>
          )}
          {showRuns && (
            <MenuItem onClick={() => navigate(runsLink())}>
              <ListItemIcon>
                <List fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Runs List" />
            </MenuItem>
          )}
        </MenuList>
      </Popover>
    </>
  );
}
