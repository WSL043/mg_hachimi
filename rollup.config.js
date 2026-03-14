import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: './scripts/src/main.ts',
  output: {
    dir: './maps/scripts/',
    format: 'es',
    entryFileNames: '[name].vjs',
  },
  plugins: [typescript({
    // include: ['./scripts/types/point_script.d.ts', './scripts/src/main.ts'],
    tsconfig: './tsconfig.json',
  }), nodeResolve(), terser()],
  external: ['cs_script/point_script'],
};
