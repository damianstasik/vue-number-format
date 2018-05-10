<template>
  <number-format v-bind="$attrs" v-on="$listeners">
    <input
      slot-scope="{ formattedValue, inputEvents }"
      :value="formattedValue"
      v-on="inputEvents"
    >
  </number-format>
</template>
<script>
import NumberFormat from './NumberFormat.vue';

export default {
  name: 'NumberFormatInput',
  components: {
    NumberFormat,
  },
};
</script>
