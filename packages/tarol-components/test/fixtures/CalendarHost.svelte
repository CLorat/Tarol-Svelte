<script lang="ts">
  import { ThemeRoot, de } from '@clorat/tarol-design';
  import { Calendar, type CalendarTone, type CalendarView } from '../../src/lib/index.js';

  interface Entry {
    title: string;
    tone: CalendarTone;
  }
  interface Props {
    date?: string;
    view?: CalendarView;
    locale?: 'en' | 'de';
    onselect?: (day: string) => void;
  }
  let { date = '2026-12-01', view = 'month', locale = 'en', onselect }: Props = $props();
  const byDay: Record<string, Entry[]> = {
    '2026-12-01': [
      { title: 'Parents evening', tone: 'accent' },
      { title: 'Closed', tone: 'danger' },
    ],
    '2026-12-24': [
      { title: 'Holiday', tone: 'warning' },
      { title: 'A', tone: 'muted' },
      { title: 'B', tone: 'muted' },
      { title: 'C', tone: 'success' },
    ],
  };
</script>

<ThemeRoot theme="light" motion="reduce" {locale} messages={locale === 'de' ? de : undefined}>
  <main>
    <Calendar
      label="Calendar"
      bind:date
      bind:view
      today="2026-12-03"
      {locale}
      {onselect}
      entries={(d) => byDay[d] ?? []}
      tone={(e) => e.tone}
    >
      {#snippet entry(e)}{e.title}{/snippet}
    </Calendar>
    <output data-testid="state">{date} {view}</output>
  </main>
</ThemeRoot>
