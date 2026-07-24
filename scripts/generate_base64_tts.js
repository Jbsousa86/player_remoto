import fs from 'fs';
import path from 'path';

const ttsDir = path.join(process.cwd(), 'public', 'audio', 'tts');
const outputFile = path.join(process.cwd(), 'src', 'lib', 'ttsAudioData.js');

const files = fs.readdirSync(ttsDir);
const data = {};

for (const file of files) {
    if (!file.endsWith('.mp3')) continue;
    const key = path.basename(file, '.mp3');
    const filePath = path.join(ttsDir, file);
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    data[key] = `data:audio/mp3;base64,${base64}`;
}

const jsContent = `// Auto-generated offline TTS audio data base64 mapping
export const ttsAudioData = ${JSON.stringify(data, null, 2)};
`;

fs.writeFileSync(outputFile, jsContent);
console.log(`Successfully generated ${outputFile} with ${Object.keys(data).length} audio clips!`);
