import React from 'react';
import { Controller, type Control, type SubmitHandler, type UseFormHandleSubmit } from 'react-hook-form';

interface FormData {
  inputType: 'json' | 'path';
  jsonInput?: string;
  pathInput?: string;
}

interface InputFormProps {
  control: Control<FormData>;
  handleSubmit: UseFormHandleSubmit<FormData>;
  onSubmit: SubmitHandler<FormData>;
  watchedInputType: 'json' | 'path';
}

export const InputForm: React.FC<InputFormProps> = ({
  control,
  handleSubmit,
  onSubmit,
  watchedInputType
}) => (
  <form onSubmit={handleSubmit(onSubmit)} className="input-form">
    <div>
      <label>
        <Controller
          name="inputType"
          control={control}
          render={({ field }) => (
            <select {...field}>
              <option value="json">JSON</option>
              <option value="path">Path</option>
            </select>
          )}
        />
      </label>
    </div>
    {watchedInputType === 'json' ? (
      <div>
        <Controller
          name="jsonInput"
          control={control}
          render={({ field }) => (
            <textarea
              {...field}
              placeholder="Paste your folder tree JSON here"
              rows={8}
              style={{ width: '100%' }}
            />
          )}
        />
      </div>
    ) : (
      <div>
        <Controller
          name="pathInput"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              placeholder="Enter a folder path (e.g. root/folder1/folder2)"
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '12px', border: '1px dotted #667eea', outline: "2px solid #747bff", backgroundColor: '#fff', boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.05)"}}
            />
          )}
        />
      </div>
    )}
    <button type="submit" style={{ marginTop: 8 }}>Visualize</button>
  </form>
);