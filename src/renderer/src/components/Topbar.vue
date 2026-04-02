<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <header class="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border bg-surface/80 backdrop-blur-sm select-none">
    <span class="text-sm font-semibold text-text-primary tracking-wide">{{ title }}</span>
    <div class="flex items-center gap-3">
      <span class="text-xs text-text-muted bg-surface-mute px-2.5 py-1 rounded-md border border-border">
        Local Mode
      </span>
    </div>
  </header>
</template>
