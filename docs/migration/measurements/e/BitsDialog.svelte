<script>import { Dialog } from 'bits-ui'; let open = $state(false);</script>
<Dialog.Root bind:open><Dialog.Trigger>Open</Dialog.Trigger><Dialog.Portal><Dialog.Overlay /><Dialog.Content><Dialog.Title>T</Dialog.Title><Dialog.Description>D</Dialog.Description><Dialog.Close>x</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
