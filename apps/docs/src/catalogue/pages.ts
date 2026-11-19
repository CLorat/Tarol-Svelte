import type { Component } from 'svelte';
import AppShell from './examples/AppShell.svelte';
import AppShellSource from './examples/AppShell.svelte?raw';
import Button from './examples/Button.svelte';
import ButtonSource from './examples/Button.svelte?raw';
import ChangeForm from './examples/ChangeForm.svelte';
import ChangeFormSource from './examples/ChangeForm.svelte?raw';
import Combobox from './examples/Combobox.svelte';
import ComboboxSource from './examples/Combobox.svelte?raw';
import DataTable from './examples/DataTable.svelte';
import DataTableSource from './examples/DataTable.svelte?raw';
import DateField from './examples/DateField.svelte';
import DateFieldSource from './examples/DateField.svelte?raw';
import DetailLayout from './examples/DetailLayout.svelte';
import DetailLayoutSource from './examples/DetailLayout.svelte?raw';
import Dialog from './examples/Dialog.svelte';
import DialogSource from './examples/Dialog.svelte?raw';
import Field from './examples/Field.svelte';
import FieldSource from './examples/Field.svelte?raw';
import MenuButton from './examples/MenuButton.svelte';
import MenuButtonSource from './examples/MenuButton.svelte?raw';
import NumberField from './examples/NumberField.svelte';
import NumberFieldSource from './examples/NumberField.svelte?raw';
import QueryState from './examples/QueryState.svelte';
import QueryStateSource from './examples/QueryState.svelte?raw';
import SearchBox from './examples/SearchBox.svelte';
import SearchBoxSource from './examples/SearchBox.svelte?raw';
import Skeleton from './examples/Skeleton.svelte';
import SkeletonSource from './examples/Skeleton.svelte?raw';
import Spinner from './examples/Spinner.svelte';
import SpinnerSource from './examples/Spinner.svelte?raw';
import Tabs from './examples/Tabs.svelte';
import TabsSource from './examples/Tabs.svelte?raw';
import TextField from './examples/TextField.svelte';
import TextFieldSource from './examples/TextField.svelte?raw';
import ThemeRoot from './examples/ThemeRoot.svelte';
import ThemeRootSource from './examples/ThemeRoot.svelte?raw';
import Toaster from './examples/Toaster.svelte';
import ToasterSource from './examples/Toaster.svelte?raw';
import VisuallyHidden from './examples/VisuallyHidden.svelte';
import VisuallyHiddenSource from './examples/VisuallyHidden.svelte?raw';

/** One catalogue page: a component (its props come from props.json), a live example and its keyboard support. */
export interface CataloguePage {
  /** The component's name (the export, and the key in props.json). */
  readonly name: string;
  /** The live example. */
  readonly example: Component;
  /** The example's source, shown under it. */
  readonly source: string;
  /** Keys and what they do (from the implementation and its tests). */
  readonly keys: readonly (readonly [string, string])[];
}

const tab: [string, string] = ['Tab', 'moves into and out of the control'];

export const pages: readonly CataloguePage[] = [
  { name: 'Button', example: Button, source: ButtonSource, keys: [tab, ['Enter, Space', 'activates']] },
  { name: 'TextField', example: TextField, source: TextFieldSource, keys: [tab] },
  {
    name: 'NumberField',
    example: NumberField,
    source: NumberFieldSource,
    keys: [tab, ['Arrow Up/Down', 'steps (native)']],
  },
  {
    name: 'DateField',
    example: DateField,
    source: DateFieldSource,
    keys: [tab, ['Arrow Up/Down', 'changes the focused part (native)']],
  },
  { name: 'Field', example: Field, source: FieldSource, keys: [tab] },
  {
    name: 'Combobox',
    example: Combobox,
    source: ComboboxSource,
    keys: [
      ['type', 'filters and opens the list'],
      ['Arrow Down/Up', 'opens the list, moves the active option (wraps); focus stays in the input'],
      ['Alt+Arrow Down', 'opens without moving'],
      ['Enter', 'chooses the active option'],
      ['Escape', 'closes the list; a second Escape clears the text'],
      ['Tab', 'leaves; a half-typed text is reset to the chosen option'],
    ],
  },
  {
    name: 'MenuButton',
    example: MenuButton,
    source: MenuButtonSource,
    keys: [
      ['Enter, Space, Arrow Down', 'opens on the first item'],
      ['Arrow Up', 'opens on the last item'],
      ['Arrow Down/Up', 'moves (wraps, skips disabled items)'],
      ['Home, End', 'first, last item'],
      ['Enter, Space', 'chooses; focus returns to the button'],
      ['Escape', 'closes; focus returns to the button'],
      ['Tab', 'closes and moves on'],
    ],
  },
  {
    name: 'Tabs',
    example: Tabs,
    source: TabsSource,
    keys: [
      ['Arrow Right/Left', 'selects the next, previous tab (wraps)'],
      ['Home, End', 'selects the first, last tab'],
      ['Tab', 'moves from the tab list to the panel'],
    ],
  },
  {
    name: 'Dialog',
    example: Dialog,
    source: DialogSource,
    keys: [
      ['Tab', 'stays inside the dialog (the page is inert)'],
      ['Escape', 'closes, unless dismissible is false; focus returns to the opener'],
    ],
  },
  {
    name: 'Toaster',
    example: Toaster,
    source: ToasterSource,
    keys: [['Tab', 'reaches the dismiss button of each toast']],
  },
  { name: 'Skeleton', example: Skeleton, source: SkeletonSource, keys: [] },
  { name: 'Spinner', example: Spinner, source: SpinnerSource, keys: [] },
  { name: 'VisuallyHidden', example: VisuallyHidden, source: VisuallyHiddenSource, keys: [] },
  { name: 'ThemeRoot', example: ThemeRoot, source: ThemeRootSource, keys: [] },
  {
    name: 'DataTable',
    example: DataTable,
    source: DataTableSource,
    keys: [
      ['Tab', 'one tab stop: the active cell, or its widget'],
      ['Arrow keys', 'move between cells'],
      ['Home, End', 'first, last cell of the row'],
      ['Ctrl+Home, Ctrl+End', 'first, last cell of the table'],
      ['Page Down/Up', '10 rows (virtual rows are scrolled in)'],
    ],
  },
  {
    name: 'QueryState',
    example: QueryState,
    source: QueryStateSource,
    keys: [['Tab', 'reaches the retry button of an error']],
  },
  { name: 'ChangeForm', example: ChangeForm, source: ChangeFormSource, keys: [['Enter', 'submits from any field']] },
  { name: 'FormField', example: ChangeForm, source: ChangeFormSource, keys: [tab] },
  { name: 'DetailLayout', example: DetailLayout, source: DetailLayoutSource, keys: [] },
  {
    name: 'SearchBox',
    example: SearchBox,
    source: SearchBoxSource,
    keys: [['as Combobox', 'the list shows the server’s hits']],
  },
  {
    name: 'AppShell',
    example: AppShell,
    source: AppShellSource,
    keys: [['Tab (first)', 'the skip link to the main content']],
  },
];
