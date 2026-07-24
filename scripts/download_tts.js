import fs from 'fs';
import path from 'path';
import https from 'https';

const ttsDir = path.join(process.cwd(), 'public', 'audio', 'tts');

if (!fs.existsSync(ttsDir)) {
    fs.mkdirSync(ttsDir, { recursive: true });
}

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const list = [
        { name: 'senha', text: 'Senha' },
        { name: 'normal', text: 'Atendimento Normal' },
        { name: 'preferencial', text: 'Atendimento Preferencial' },
    ];

    // Add digits 0-9
    for (let i = 0; i <= 9; i++) {
        list.push({ name: String(i), text: String(i) });
    }

    // Add letters A-Z
    for (let i = 65; i <= 90; i++) {
        const letter = String.fromCharCode(i);
        list.push({ name: letter.toLowerCase(), text: letter });
    }

    console.log(`Starting download of ${list.length} TTS files...`);

    for (const item of list) {
        const dest = path.join(ttsDir, `${item.name}.mp3`);
        // If file already exists, skip
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
            console.log(`Skipping ${item.name}.mp3 (already exists)`);
            continue;
        }
        
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encodeURIComponent(item.text)}`;
        console.log(`Downloading ${item.name}.mp3 for "${item.text}"...`);
        try {
            await downloadFile(url, dest);
            // Delay to avoid rate limiting
            await delay(300);
        } catch (err) {
            console.error(`Error downloading ${item.name}.mp3:`, err.message);
        }
    }
    console.log('All downloads completed!');
}

main().catch(console.error);
