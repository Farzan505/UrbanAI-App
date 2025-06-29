<script lang="ts" setup>
import { Toaster as Sonner, type ToasterProps } from 'vue-sonner'

const props = defineProps<ToasterProps>()
</script>

<template>
  <Sonner
    class="toaster group"
    v-bind="props"
    :style="{
      '--normal-bg': 'hsl(var(--background))',
      '--normal-text': 'hsl(var(--foreground))',
      '--normal-border': 'hsl(var(--border))',
      '--success-bg': 'hsl(var(--background))',
      '--success-text': 'hsl(var(--foreground))',
      '--success-border': 'hsl(var(--border))',
      '--error-bg': 'hsl(var(--destructive))',
      '--error-text': 'hsl(var(--destructive-foreground))',
      '--error-border': 'hsl(var(--destructive))',
    }"
  />
</template>

<style>
.toaster {
  --width: 356px;
  --font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
}

.toaster[data-sonner-toaster] {
  position: fixed !important;
  bottom: 0 !important;
  right: 0 !important;
  z-index: 999999 !important;
  pointer-events: none !important;
  padding: 16px !important;
}

.toaster[data-sonner-toaster] [data-sonner-toast] {
  pointer-events: auto !important;
  background: hsl(var(--background)) !important;
  border: 1px solid hsl(var(--border)) !important;
  color: hsl(var(--foreground)) !important;
  border-radius: calc(var(--radius) - 2px) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25) !important;
  padding: 16px !important;
  margin-bottom: 8px !important;
  min-width: 356px !important;
  font-family: var(--font-family) !important;
  opacity: 1 !important;
  backdrop-filter: none !important;
}

.toaster[data-sonner-toaster] [data-sonner-toast][data-type="success"] {
  background: hsl(var(--background)) !important;
  border-color: hsl(var(--success, var(--primary))) !important;
  color: hsl(var(--foreground)) !important;
}

.toaster[data-sonner-toaster] [data-sonner-toast][data-type="error"] {
  background: hsl(var(--destructive)) !important;
  border-color: hsl(var(--destructive)) !important;
  color: hsl(var(--destructive-foreground)) !important;
}

.toaster[data-sonner-toaster] [data-sonner-toast] [data-title] {
  font-weight: 500 !important;
  font-size: 14px !important;
  line-height: 1.4 !important;
  margin-bottom: 4px !important;
}

.toaster[data-sonner-toaster] [data-sonner-toast] [data-description] {
  font-size: 13px !important;
  opacity: 0.8 !important;
  line-height: 1.4 !important;
}
</style>
