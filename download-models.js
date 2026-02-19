// download-models.js
import https from 'https';
import fs from 'fs';
import path from 'path';

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const modelsDir = './public/models';

// Create models directory if it doesn't exist
if (!fs.existsSync(modelsDir)){
    fs.mkdirSync(modelsDir, { recursive: true });
}

const modelFiles = [
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2',
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1'
    
];

function downloadFile(filename) {
    return new Promise((resolve, reject) => {
        const filepath = path.join(modelsDir, filename);
        const file = fs.createWriteStream(filepath);
        
        https.get(`${baseUrl}/${filename}`, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded: ${filename}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {}); // Delete the file if there was an error
            reject(err);
        });
    });
}

async function downloadModels() {
    try {
        console.log('Starting downloads...');
        await Promise.all(modelFiles.map(file => downloadFile(file)));
        console.log('All models downloaded successfully!');
    } catch (error) {
        console.error('Error downloading models:', error);
    }
}

downloadModels();