import React from 'react';
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  Switch,
  Autocomplete,
  Chip,
  Box,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Controller, Control, FieldError } from 'react-hook-form';
import dayjs, { Dayjs } from 'dayjs';

interface BaseFieldProps {
  name: string;
  control: Control<any>;
  label: string;
  error?: FieldError;
  disabled?: boolean;
  required?: boolean;
}

// Text Input Component
interface TextFieldProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

export const FormTextField: React.FC<TextFieldProps> = ({
  name,
  control,
  label,
  error,
  type = 'text',
  multiline = false,
  rows = 4,
  placeholder,
  startAdornment,
  endAdornment,
  disabled = false,
  required = false,
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <TextField
        {...field}
        fullWidth
        label={label}
        type={type}
        multiline={multiline}
        rows={multiline ? rows : undefined}
        placeholder={placeholder}
        error={!!error}
        helperText={error?.message}
        disabled={disabled}
        required={required}
        InputProps={{
          startAdornment,
          endAdornment,
        }}
      />
    )}
  />
);

// Select Component
interface SelectFieldProps extends BaseFieldProps {
  options: Array<{ value: any; label: string; disabled?: boolean }>;
  multiple?: boolean;
}

export const FormSelectField: React.FC<SelectFieldProps> = ({
  name,
  control,
  label,
  error,
  options,
  multiple = false,
  disabled = false,
  required = false,
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <FormControl fullWidth error={!!error} disabled={disabled} required={required}>
        <InputLabel>{label}</InputLabel>
        <Select
          {...field}
          label={label}
          multiple={multiple}
          renderValue={multiple ? (selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((value) => {
                const option = options.find(opt => opt.value === value);
                return (
                  <Chip key={value} label={option?.label || value} size="small" />
                );
              })}
            </Box>
          ) : undefined}
        >
          {options.map((option) => (
            <MenuItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {error && <FormHelperText>{error.message}</FormHelperText>}
      </FormControl>
    )}
  />
);

// Autocomplete Component
interface AutocompleteFieldProps extends BaseFieldProps {
  options: Array<{ value: any; label: string }>;
  multiple?: boolean;
  freeSolo?: boolean;
  loading?: boolean;
}

export const FormAutocompleteField: React.FC<AutocompleteFieldProps> = ({
  name,
  control,
  label,
  error,
  options,
  multiple = false,
  freeSolo = false,
  loading = false,
  disabled = false,
  required = false,
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field: { onChange, value, ...field } }) => (
      <Autocomplete
        {...field}
        options={options}
        getOptionLabel={(option) => 
          typeof option === 'string' ? option : option.label || ''
        }
        value={value || (multiple ? [] : null)}
        onChange={(_, newValue) => onChange(newValue)}
        multiple={multiple}
        freeSolo={freeSolo}
        loading={loading}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            error={!!error}
            helperText={error?.message}
            required={required}
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              variant="outlined"
              label={typeof option === 'string' ? option : option.label}
              {...getTagProps({ index })}
              key={index}
            />
          ))
        }
      />
    )}
  />
);

// Date Picker Component
interface DateFieldProps extends BaseFieldProps {
  minDate?: Dayjs;
  maxDate?: Dayjs;
}

export const FormDateField: React.FC<DateFieldProps> = ({
  name,
  control,
  label,
  error,
  minDate,
  maxDate,
  disabled = false,
  required = false,
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <DatePicker
        label={label}
        value={field.value ? dayjs(field.value) : null}
        onChange={(date) => field.onChange(date?.toISOString())}
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        slotProps={{
          textField: {
            fullWidth: true,
            error: !!error,
            helperText: error?.message,
            required,
          },
        }}
      />
    )}
  />
);

// Checkbox Component
interface CheckboxFieldProps extends BaseFieldProps {
  color?: 'primary' | 'secondary' | 'default';
}

export const FormCheckboxField: React.FC<CheckboxFieldProps> = ({
  name,
  control,
  label,
  error,
  color = 'primary',
  disabled = false,
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <Box>
        <FormControlLabel
          control={
            <Checkbox
              {...field}
              checked={field.value || false}
              color={color}
              disabled={disabled}
            />
          }
          label={label}
        />
        {error && (
          <Typography variant="caption" color="error" display="block">
            {error.message}
          </Typography>
        )}
      </Box>
    )}
  />
);

// Radio Group Component
interface RadioFieldProps extends BaseFieldProps {
  options: Array<{ value: any; label: string; disabled?: boolean }>;
  row?: boolean;
}

export const FormRadioField: React.FC<RadioFieldProps> = ({
  name,
  control,
  label,
  error,
  options,
  row = false,
  disabled = false,
  required = false,
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <FormControl error={!!error} disabled={disabled} required={required}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <RadioGroup {...field} row={row}>
          {options.map((option) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio />}
              label={option.label}
              disabled={option.disabled}
            />
          ))}
        </RadioGroup>
        {error && <FormHelperText>{error.message}</FormHelperText>}
      </FormControl>
    )}
  />
);

// Switch Component
interface SwitchFieldProps extends BaseFieldProps {
  color?: 'primary' | 'secondary' | 'default';
}

export const FormSwitchField: React.FC<SwitchFieldProps> = ({
  name,
  control,
  label,
  error,
  color = 'primary',
  disabled = false,
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <Box>
        <FormControlLabel
          control={
            <Switch
              {...field}
              checked={field.value || false}
              color={color}
              disabled={disabled}
            />
          }
          label={label}
        />
        {error && (
          <Typography variant="caption" color="error" display="block">
            {error.message}
          </Typography>
        )}
      </Box>
    )}
  />
);