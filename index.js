const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Настройки
const INPUT_DIR = './input'; // Папка с исходными изображениями
const OUTPUT_DIR = './output'; // Папка для обработанных изображений
const TARGET_SIZE = 1024;
const COMPRESSION_QUALITY = 80; // Качество сжатия (1-100)
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.gif'];

async function processImage(filePath, outputPath) {
    try {
        const image = sharp(filePath);
        const metadata = await image.metadata();

        // Рассчитываем параметры для обрезки с сохранением пропорций
        const { width, height } = metadata;
        const minDimension = Math.min(width, height);
        const left = Math.floor((width - minDimension) / 2);
        const top = Math.floor((height - minDimension) / 2);

        // Обрезаем до квадрата по минимальной стороне
        const croppedImage = await image
            .extract({
                left,
                top,
                width: minDimension,
                height: minDimension,
            })
            .resize(TARGET_SIZE, TARGET_SIZE, {
                fit: 'cover',
                withoutEnlargement: true, // Не увеличиваем изображения меньше 1024x1024
            })
            .toBuffer();

        // Определяем формат выходного файла
        const ext = path.extname(filePath).toLowerCase();
        let outputImage = sharp(croppedImage);

        // Настройки сжатия в зависимости от формата
        if (ext === '.jpg' || ext === '.jpeg') {
            outputImage = outputImage.jpeg({
                quality: COMPRESSION_QUALITY,
                mozjpeg: true
            });
        } else if (ext === '.png') {
            outputImage = outputImage.png({
                compressionLevel: 9,
                quality: COMPRESSION_QUALITY
            });
        } else if (ext === '.webp') {
            outputImage = outputImage.webp({
                quality: COMPRESSION_QUALITY
            });
        }

        // Сохраняем изображение
        await outputImage.toFile(outputPath);

        const stats = await fs.stat(outputPath);
        console.log(`✓ Обработано: ${path.basename(filePath)} -> ${path.basename(outputPath)} (${(stats.size / 1024).toFixed(2)} KB)`);

        return true;
    } catch (error) {
        console.error(`✗ Ошибка при обработке ${filePath}:`, error.message);
        return false;
    }
}

async function getAllImageFiles(dir) {
    const files = [];

    async function scanDirectory(currentDir) {
        const items = await fs.readdir(currentDir, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(currentDir, item.name);

            if (item.isDirectory()) {
                await scanDirectory(fullPath);
            } else if (item.isFile()) {
                const ext = path.extname(item.name).toLowerCase();
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }

    await scanDirectory(dir);
    return files;
}

async function ensureDirectoryExists(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Создана папка: ${dirPath}`);
    }
}

async function main() {
    try {
        // Проверяем существование папок
        await ensureDirectoryExists(INPUT_DIR);
        await ensureDirectoryExists(OUTPUT_DIR);

        console.log('🔍 Поиск изображений...');
        const imageFiles = await getAllImageFiles(INPUT_DIR);

        if (imageFiles.length === 0) {
            console.log('❌ Изображения не найдены в папке', INPUT_DIR);
            return;
        }

        console.log(`📁 Найдено ${imageFiles.length} изображений`);
        console.log('⏳ Начинаю обработку...\n');

        let processedCount = 0;
        let failedCount = 0;

        // Обрабатываем все изображения
        for (const filePath of imageFiles) {
            const relativePath = path.relative(INPUT_DIR, filePath);
            const outputPath = path.join(OUTPUT_DIR, relativePath);

            // Создаем под папки в выходной директории
            const outputDir = path.dirname(outputPath);
            await ensureDirectoryExists(outputDir);

            const success = await processImage(filePath, outputPath);

            if (success) {
                processedCount++;
            } else {
                failedCount++;
            }
        }

        console.log('\n✅ Обработка завершена!');
        console.log(`✓ Успешно: ${processedCount}`);
        console.log(`✗ С ошибками: ${failedCount}`);
        console.log(`📁 Результаты сохранены в: ${OUTPUT_DIR}`);

    } catch (error) {
        console.error('❌ Критическая ошибка:', error.message);
    }
}

// Запуск скрипта
void main();
