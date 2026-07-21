#!/usr/bin/env node
import { encrypt } from '../lib/crypto.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const passphrase = process.env.ENCRYPTION_KEY;

if (!passphrase) {
  console.error('Error: ENCRYPTION_KEY environment variable is required');
  console.error('Usage: ENCRYPTION_KEY=your-passphrase node dist/scripts/encrypt-env.js');
  process.exit(1);
}

console.log('Enter value to encrypt (press Enter twice to finish):');
console.log('Format: KEY=value');
console.log('');

let input = '';
let lineCount = 0;

rl.on('line', (line) => {
  if (line.trim() === '' && lineCount > 0) {
    rl.close();
    return;
  }
  
  input += line + '\n';
  lineCount++;
});

rl.on('close', () => {
  const lines = input.trim().split('\n');
  
  for (const line of lines) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) {
      console.error(`Invalid format: ${line}`);
      continue;
    }

    const [, key, value] = match;
    const encrypted = encrypt(value, passphrase);
    console.log(`${key}=${encrypted}`);
  }
});
