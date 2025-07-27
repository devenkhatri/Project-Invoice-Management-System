import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Paper,
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  MoreVert,
  Search,
  FilterList,
  GetApp,
} from '@mui/icons-material';
import { visuallyHidden } from '@mui/utils';

export interface Column<T = any> {
  id: keyof T;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  selectable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  actions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: (row: T) => void;
  }>;
  onSelectionChange?: (selected: T[]) => void;
  onExport?: () => void;
  loading?: boolean;
  emptyMessage?: string;
}

type Order = 'asc' | 'desc';

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key,
): (a: { [key in Key]: number | string }, b: { [key in Key]: number | string }) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort<T>(array: readonly T[], comparator: (a: T, b: T) => number) {
  const stabilizedThis = array.map((el, index) => [el, index] as [T, number]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) {
      return order;
    }
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

const DataTable = <T extends Record<string, any>>({
  columns,
  data,
  title,
  selectable = false,
  searchable = true,
  filterable = false,
  exportable = false,
  actions = [],
  onSelectionChange,
  onExport,
  loading = false,
  emptyMessage = 'No data available',
}: DataTableProps<T>) => {
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof T>(columns[0]?.id);
  const [selected, setSelected] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionAnchorEl, setActionAnchorEl] = useState<null | HTMLElement>(null);
  const [actionRow, setActionRow] = useState<T | null>(null);

  const handleRequestSort = (property: keyof T) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(filteredData);
      onSelectionChange?.(filteredData);
    } else {
      setSelected([]);
      onSelectionChange?.([]);
    }
  };

  const handleClick = (row: T) => {
    if (!selectable) return;

    const selectedIndex = selected.findIndex(item => item.id === row.id);
    let newSelected: T[] = [];

    if (selectedIndex === -1) {
      newSelected = [...selected, row];
    } else {
      newSelected = selected.filter(item => item.id !== row.id);
    }

    setSelected(newSelected);
    onSelectionChange?.(newSelected);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleActionClick = (event: React.MouseEvent<HTMLElement>, row: T) => {
    setActionAnchorEl(event.currentTarget);
    setActionRow(row);
  };

  const handleActionClose = () => {
    setActionAnchorEl(null);
    setActionRow(null);
  };

  const isSelected = (row: T) => selected.some(item => item.id === row.id);

  // Filter data based on search term
  const filteredData = data.filter(row =>
    searchTerm === '' ||
    columns.some(column =>
      String(row[column.id]).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Sort filtered data
  const sortedData = stableSort(filteredData, getComparator(order, orderBy));

  // Paginate sorted data
  const paginatedData = sortedData.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Paper sx={{ width: '100%', mb: 2 }}>
      {/* Toolbar */}
      <Toolbar
        sx={{
          pl: { sm: 2 },
          pr: { xs: 1, sm: 1 },
          ...(selected.length > 0 && {
            bgcolor: (theme) =>
              theme.palette.mode === 'light'
                ? theme.palette.primary.light
                : theme.palette.primary.dark,
          }),
        }}
      >
        {selected.length > 0 ? (
          <Typography
            sx={{ flex: '1 1 100%' }}
            color="inherit"
            variant="subtitle1"
            component="div"
          >
            {selected.length} selected
          </Typography>
        ) : (
          <Typography
            sx={{ flex: '1 1 100%' }}
            variant="h6"
            id="tableTitle"
            component="div"
          >
            {title}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          {searchable && (
            <TextField
              size="small"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          )}

          {filterable && (
            <IconButton>
              <FilterList />
            </IconButton>
          )}

          {exportable && (
            <IconButton onClick={onExport}>
              <GetApp />
            </IconButton>
          )}
        </Box>
      </Toolbar>

      {/* Table */}
      <TableContainer>
        <Table stickyHeader aria-labelledby="tableTitle">
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={selected.length > 0 && selected.length < filteredData.length}
                    checked={filteredData.length > 0 && selected.length === filteredData.length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={String(column.id)}
                  align={column.align}
                  style={{ minWidth: column.minWidth }}
                  sortDirection={orderBy === column.id ? order : false}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                      {orderBy === column.id ? (
                        <Box component="span" sx={visuallyHidden}>
                          {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                        </Box>
                      ) : null}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
              {actions.length > 0 && (
                <TableCell align="center">Actions</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row, index) => {
              const isItemSelected = isSelected(row);
              const labelId = `enhanced-table-checkbox-${index}`;

              return (
                <TableRow
                  hover
                  onClick={() => handleClick(row)}
                  role="checkbox"
                  aria-checked={isItemSelected}
                  tabIndex={-1}
                  key={row.id || index}
                  selected={isItemSelected}
                  sx={{ cursor: selectable ? 'pointer' : 'default' }}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                        inputProps={{
                          'aria-labelledby': labelId,
                        }}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={String(column.id)} align={column.align}>
                      {column.render
                        ? column.render(row[column.id], row)
                        : row[column.id]}
                    </TableCell>
                  ))}
                  {actions.length > 0 && (
                    <TableCell align="center">
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionClick(e, row);
                        }}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {paginatedData.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                  align="center"
                  sx={{ py: 4 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={filteredData.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      {/* Actions Menu */}
      <Menu
        anchorEl={actionAnchorEl}
        open={Boolean(actionAnchorEl)}
        onClose={handleActionClose}
      >
        {actions.map((action, index) => (
          <MenuItem
            key={index}
            onClick={() => {
              action.onClick(actionRow!);
              handleActionClose();
            }}
          >
            {action.icon && <Box sx={{ mr: 1 }}>{action.icon}</Box>}
            {action.label}
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
};

export default DataTable;