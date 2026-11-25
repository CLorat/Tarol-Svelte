<script lang="ts">
  import { Calendar, type CalendarTone } from '@clorat/tarol-components';

  interface Appointment {
    title: string;
    time: string;
    tone: CalendarTone;
  }
  // fixed days, so the example (and its screenshot) does not change with the date
  const byDay: Record<string, Appointment[]> = {
    '2026-12-01': [{ title: 'Parents evening', time: '18:00', tone: 'accent' }],
    '2026-12-08': [
      { title: 'Closed (training)', time: '', tone: 'danger' },
      { title: 'Swimming', time: '10:00', tone: 'success' },
    ],
    '2026-12-24': [{ title: 'Christmas Eve', time: '', tone: 'warning' }],
  };
  let date = $state('2026-12-01');
  let view = $state<'month' | 'week' | 'day'>('month');
</script>

<Calendar
  label="Appointments"
  bind:date
  bind:view
  today="2026-12-03"
  entries={(day) => byDay[day] ?? []}
  tone={(a: Appointment) => a.tone}
>
  {#snippet entry(a: Appointment)}{a.time ? `${a.time} ${a.title}` : a.title}{/snippet}
</Calendar>
<p>Chosen: {date} ({view})</p>
