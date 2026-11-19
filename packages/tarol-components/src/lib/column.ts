/** A column of a DataTable. */
export interface Column {
  /** A stable key; passed back to the cell snippet. */
  readonly key: string;
  /** The header text (the app's own, already translated). */
  readonly header: string;
  /**
   * The backend sort this header selects: the `sort` enum member name of the list's query, and its fixed direction
   * (Tarol's `[Descending]` sets the direction per member).
   */
  readonly sort?: { readonly value: string; readonly direction: 'ascending' | 'descending' };
  /** `end` for numbers. */
  readonly align?: 'start' | 'end';
  /** A CSS width. */
  readonly width?: string;
}
