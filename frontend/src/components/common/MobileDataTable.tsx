import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  useTheme,
  useMediaQuery,
  SwipeableDrawer,
  Button,
  Stack,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  SwipeLeft as SwipeLeftIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useSwipeable } from 'react-swipeable';

export interface MobileDataTableColumn {
  id: string;
  label: string;
  format?: (value: any) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface MobileDataTableRow {
  id: string;
  [key: string]: any;
}

export interface MobileDataTableAction {
  label: string;
  icon: React.ReactNode;
  onClick: (row: MobileDataTableRow) => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

interface MobileDataTableProps {
  columns: MobileDataTableColumn[];
  rows: MobileDataTableRow[];
  actions?: MobileDataTableAction[];
  onRowClick?: (row: MobileDataTableRow) => void;
  primaryColumn: string;
  secondaryColumn?: string;
  statusColumn?: string;
  avatarColumn?: string;
  swipeActions?: {
    left?: MobileDataTableAction;
    right?: MobileDataTableAction;
  };
  loading?: boolean;
  emptyMessage?: string;
}

const MobileDataTable: React.FC<MobileDataTableProps> = ({
  columns,
  rows,
  actions = [],
  onRowClick,
  primaryColumn,
  secondaryColumn,
  statusColumn,
  avatarColumn,
  swipeActions,
  loading = false,
  emptyMessage = 'No data available',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedRow, setSelectedRow] = useState<MobileDataTableRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [swipedRow, setSwipedRow] = useState<string | null>(null);

  const handleRowClick = (row: MobileDataTableRow) => {
    if (onRowClick) {
      onRowClick(row);
    }
  };

  const handleActionsClick = (row: MobileDataTableRow, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedRow(row);
    setDrawerOpen(true);
  };

  const handleActionClick = (action: MobileDataTableAction) => {
    if (selectedRow) {
      action.onClick(selectedRow);
      setDrawerOpen(false);
      setSelectedRow(null);
    }
  };

  const getSwipeHandlers = (row: MobileDataTableRow) => {
    if (!swipeActions) return {};

    return useSwipeable({
      onSwipedLeft: () => {
        if (swipeActions.left) {
          setSwipedRow(row.id);
          setTimeout(() => setSwipedRow(null), 2000);
        }
      },
      onSwipedRight: () => {
        if (swipeActions.right) {
          setSwipedRow(row.id);
          setTimeout(() => setSwipedRow(null), 2000);
        }
      },
      trackMouse: true,
    });
  };

  const renderStatus = (value: any) => {
    const statusColors: { [key: string]: any } = {
      active: 'success',
      completed: 'info',
      'on-hold': 'warning',
      cancelled: 'error',
      paid: 'success',
      pending: 'warning',
      overdue: 'error',
      draft: 'default',
    };

    return (
      <Chip
        label={value}
        color={statusColors[value] || 'default'}
        size="small"
        variant="outlined"
      />
    );
  };

  const renderAvatar = (value: any) => {
    if (typeof value === 'string') {
      return (
        <Avatar sx={{ width: 40, height: 40 }}>
          {value.charAt(0).toUpperCase()}
        </Avatar>
      );
    }
    return <Avatar sx={{ width: 40, height: 40 }} src={value} />;
  };

  if (!isMobile) {
    // Render regular table for desktop with horizontal scrolling
    return (
      <Box sx={{ 
        overflowX: 'auto',
        '& table': {
          minWidth: 650,
        },
        '& th, & td': {
          whiteSpace: 'nowrap',
        },
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    borderBottom: '1px solid #e0e0e0',
                    fontWeight: 600,
                  }}
                >
                  {column.label}
                </th>
              ))}
              {actions.length > 0 && (
                <th style={{ padding: '12px 16px', width: '100px' }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => handleRowClick(row)}
                style={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    style={{ padding: '12px 16px' }}
                  >
                    {column.format ? column.format(row[column.id]) : row[column.id]}
                  </td>
                ))}
                {actions.length > 0 && (
                  <td style={{ padding: '12px 16px' }}>
                    <IconButton
                      onClick={(e) => handleActionsClick(row, e)}
                      size="small"
                    >
                      <MoreIcon />
                    </IconButton>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="textSecondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <List sx={{ p: 0 }}>
        {rows.map((row, index) => {
          const swipeHandlers = getSwipeHandlers(row);
          const isSwipedLeft = swipedRow === row.id && swipeActions?.left;
          const isSwipedRight = swipedRow === row.id && swipeActions?.right;

          return (
            <React.Fragment key={row.id}>
              <ListItem
                {...swipeHandlers}
                sx={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  position: 'relative',
                  backgroundColor: isSwipedLeft || isSwipedRight ? 
                    theme.palette.action.hover : 'transparent',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
                onClick={() => handleRowClick(row)}
              >
                {avatarColumn && (
                  <ListItemAvatar>
                    {renderAvatar(row[avatarColumn])}
                  </ListItemAvatar>
                )}
                
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" noWrap>
                        {row[primaryColumn]}
                      </Typography>
                      {statusColumn && renderStatus(row[statusColumn])}
                    </Box>
                  }
                  secondary={
                    secondaryColumn ? (
                      <Typography variant="body2" color="textSecondary" noWrap>
                        {row[secondaryColumn]}
                      </Typography>
                    ) : undefined
                  }
                />

                {actions.length > 0 && (
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={(e) => handleActionsClick(row, e)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}

                {/* Swipe action indicators */}
                {isSwipedLeft && swipeActions?.left && (
                  <Box
                    sx={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: swipeActions.left.color || 'primary',
                    }}
                  >
                    {swipeActions.left.icon}
                    <Typography variant="caption">
                      {swipeActions.left.label}
                    </Typography>
                  </Box>
                )}

                {isSwipedRight && swipeActions?.right && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: swipeActions.right.color || 'primary',
                    }}
                  >
                    {swipeActions.right.icon}
                    <Typography variant="caption">
                      {swipeActions.right.label}
                    </Typography>
                  </Box>
                )}
              </ListItem>
              
              {index < rows.length - 1 && <Divider />}
            </React.Fragment>
          );
        })}
      </List>

      {/* Actions drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpen={() => setDrawerOpen(true)}
        disableSwipeToOpen
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Actions
          </Typography>
          <Stack spacing={1}>
            {actions.map((action, index) => (
              <Button
                key={index}
                startIcon={action.icon}
                onClick={() => handleActionClick(action)}
                color={action.color || 'primary'}
                variant="outlined"
                fullWidth
              >
                {action.label}
              </Button>
            ))}
          </Stack>
        </Box>
      </SwipeableDrawer>
    </Box>
  );
};

export default MobileDataTable;