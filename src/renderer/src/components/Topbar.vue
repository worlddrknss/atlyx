<script setup lang="ts">
defineProps<{
  title: string
  dbMode?: string
}>()
</script>

<template>
  <header
    class="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border bg-surface/80 backdrop-blur-sm select-none"
  >
    <span class="text-sm font-semibold text-text-primary tracking-wide">{{ title }}</span>
    <div class="flex items-center gap-3">
      <span
        class="text-xs px-2.5 py-1 rounded-md border font-medium"
        :class="
          dbMode === 'remote'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-surface-mute text-text-muted border-border'
        "
      >
        {{ dbMode === 'remote' ? '● Remote Mode' : '○ Local Mode' }}
      </span>
    </div>
  </header>
</template>
