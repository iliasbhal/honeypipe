
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory
const workerPath = path.resolve(__dirname,"./cli/worker");

const worker = spawn('tsx', [workerPath, ''], {
  stdio: 'pipe',

});

worker.stdout.on('data', (data) => {
  console.log('WORKER', data.toString());
});

worker.on('message', (message) => {
  console.log('WORKERAAA', message);
});

// worker.on('message', (message) => {
//   console.log('WORKER', message);
// });