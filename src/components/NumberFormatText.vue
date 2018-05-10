<template>
  <number-format v-bind="$attrs">
    <component slot-scope="{ formattedValue }" :is="tag">
      {{ formattedValue }}
    </component>
  </number-format>
</template>
<script>
import NumberFormat from './NumberFormat.vue';

export default {
  name: 'NumberFormatText',
  components: {
    NumberFormat,
  },
  props: {
    tag: {
      type: String,
      default: 'span',
    },
  },
};
</script>
