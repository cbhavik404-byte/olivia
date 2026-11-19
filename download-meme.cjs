const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'public', 'videos', 'meme.mp4');

// Ensure public/videos directory exists
const dir = path.dirname(targetPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Famous short YouTube IDs for "koi baat nahi hum to chutiya hain"
const videoIds = [
  'EvblckQ3E1E', // 15 seconds clip
  'FfBfsJg5J34', // Short clip
  'R_s2FJM-bA4'  // Fallback
];

async function download(index = 0) {
  if (index >= videoIds.length) {
    console.error('All video fallbacks failed.');
    process.exit(1);
  }

  const videoId = videoIds[index];
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`Attempting to download ${url} to ${targetPath}...`);

  try {
    const stream = ytdl(url, {
      filter: 'audioandvideo',
      quality: 'highestvideo'
    });

    const writeStream = fs.createWriteStream(targetPath);
    stream.pipe(writeStream);

    writeStream.on('finish', () => {
      console.log(`Successfully downloaded meme video! Size: ${fs.statSync(targetPath).size} bytes`);
      process.exit(0);
    });

    writeStream.on('error', (err) => {
      console.error(`WriteStream error for ${videoId}:`, err);
      download(index + 1);
    });

    stream.on('error', (err) => {
      console.error(`ytdl error for ${videoId}:`, err);
      download(index + 1);
    });
  } catch (err) {
    console.error(`Catch error for ${videoId}:`, err);
    download(index + 1);
  }
}

download();
