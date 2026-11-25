<script lang="ts">
  import { Tabs, ThemeRoot } from '../../src/lib/index.js';

  // Tatalu's profile: six tabs with German labels, at 360 px
  const tabs = [
    { id: 'person', label: 'Persönliche Daten' },
    { id: 'contact', label: 'Kontaktdaten' },
    { id: 'bank', label: 'Bankverbindung' },
    { id: 'insurance', label: 'Versicherungen' },
    { id: 'documents', label: 'Dokumente' },
    { id: 'privacy', label: 'Datenschutz' },
  ];
  let selected = $state('person');
</script>

<ThemeRoot locale="en">
  <main>
    <Tabs label="Profile" {tabs} bind:selected>
      {#snippet children(id)}<p>Panel {id}</p>{/snippet}
    </Tabs>
  </main>
</ThemeRoot>
