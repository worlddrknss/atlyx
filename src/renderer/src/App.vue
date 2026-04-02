<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Topbar from './components/Topbar.vue'
import CommandPalette from './components/CommandPalette.vue'
import DashboardView from './components/DashboardView.vue'
import ScanView from './components/ScanView.vue'
import ItemsView from './components/ItemsView.vue'
import LocationsView from './components/LocationsView.vue'
import LabelsView from './components/LabelsView.vue'
import ActivityView from './components/ActivityView.vue'
import SettingsView from './components/SettingsView.vue'

const activeView = ref('dashboard')

const viewTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  scan: 'Scan',
  items: 'Items',
  locations: 'Locations',
  labels: 'Labels',
  activity: 'Activity',
  settings: 'Settings'
}

function navigate(view: string): void {
  activeView.value = view
}
</script>

<template>
  <div class="flex h-screen bg-surface text-text-primary overflow-hidden">
    <Sidebar :active-view="activeView" @navigate="navigate" />

    <div class="flex-1 flex flex-col min-w-0">
      <Topbar :title="viewTitles[activeView] ?? 'Atlyx'" />

      <main class="flex-1 overflow-y-auto">
        <DashboardView v-if="activeView === 'dashboard'" />
        <ScanView v-else-if="activeView === 'scan'" />
        <ItemsView v-else-if="activeView === 'items'" />
        <LocationsView v-else-if="activeView === 'locations'" />
        <LabelsView v-else-if="activeView === 'labels'" />
        <ActivityView v-else-if="activeView === 'activity'" />
        <SettingsView v-else-if="activeView === 'settings'" />
      </main>
    </div>

    <CommandPalette @navigate="navigate" />
  </div>
</template>
