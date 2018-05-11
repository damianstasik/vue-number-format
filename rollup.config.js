const vue = require('rollup-plugin-vue');
const buble = require('rollup-plugin-buble');
const uglify = require('rollup-plugin-uglify');

export default {
  input: 'src/index.js',
  output: {
    name: 'VueNumberFormat',
    file: 'dist/vue-number-format.js',
    format: 'umd',
    exports: 'named',
    globals: {
      vue: 'Vue',
    },
  },
  external: [
    'vue',
  ],
  plugins: [
    vue({
      compileTemplate: true,
    }),
    buble(),
    uglify(),
  ],
};
