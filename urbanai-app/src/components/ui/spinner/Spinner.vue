<template>
  <div :class="cn('animate-spin rounded-full border-2 border-current border-t-transparent', className)" :style="{ width: size, height: size }" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  size?: string
  className?: string
}

withDefaults(defineProps<Props>(), {
  size: '16px',
  className: ''
})
</script>
