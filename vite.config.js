import { defineConfig } from 'vite';
import { execSync } from 'child_process';

function getCommitHash() { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'unknown'; } }
function getBranch() { try { return execSync('git rev-parse --abbrev-ref HEAD').toString().trim(); } catch { return 'unknown'; } }
function getBuildTime() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
  define: {
    __COMMIT_HASH__: JSON.stringify(getCommitHash()),
    __BRANCH__: JSON.stringify(getBranch()),
    __BUILD_TIME__: JSON.stringify(getBuildTime()),
  }
});
