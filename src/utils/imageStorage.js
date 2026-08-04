import { supabase } from '../supabaseClient';

/**
 * Returns the avatar URL ONLY if it's a valid Storage / HTTP URL or relative path.
 * Ignores old base64 data URLs ('data:image...') to avoid loading heavy base64 strings.
 * @param {string} url 
 * @param {string|null} fallback Optional fallback URL (e.g. '/anon.png')
 * @returns {string|null} Public URL or fallback
 */
export function getProfileImage(url, fallback = null) {
    if (!url || typeof url !== 'string') return fallback;
    if (url.startsWith('data:')) return fallback; // Ignore old base64 strings
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
        return url;
    }
    return fallback;
}

/**
 * Converts a base64 data URL to a Blob object
 */
export function dataURLtoBlob(dataurl) {
    if (!dataurl || typeof dataurl !== 'string' || !dataurl.startsWith('data:')) {
        return null;
    }
    try {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (err) {
        console.error('Error converting dataURL to Blob:', err);
        return null;
    }
}

/**
 * Compresses and resizes an image Blob or File using Canvas
 * @param {Blob|File} file 
 * @param {number} maxWidth Maximum width/height in pixels (default 600px for avatars)
 * @param {number} quality JPEG compression quality (default 0.75)
 * @returns {Promise<Blob>} Compressed JPEG Blob
 */
export async function compressImage(file, maxWidth = 600, quality = 0.75) {
    if (!file || !(file instanceof Blob || file instanceof File)) {
        return file;
    }

    // Only compress in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return file;
    }

    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let { width, height } = img;

            // Downscale if larger than maxWidth
            if (width > maxWidth || height > maxWidth) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxWidth) / height);
                    height = maxWidth;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (compressedBlob) => {
                    resolve(compressedBlob || file);
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };

        img.src = objectUrl;
    });
}

/**
 * Uploads an image (File, Blob, or Base64 DataURL) to Supabase Storage after compression
 * @param {File | Blob | string} imageInput - Image to upload
 * @param {string} folder - Folder within the 'uploads' bucket (e.g. 'avatars')
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export async function uploadImageToStorage(imageInput, folder = 'avatars') {
    if (!imageInput) return null;

    // If already a web URL, return as-is
    if (typeof imageInput === 'string' && (imageInput.startsWith('http://') || imageInput.startsWith('https://') || imageInput.startsWith('/'))) {
        return imageInput;
    }

    let fileToUpload = imageInput;

    if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
        fileToUpload = dataURLtoBlob(imageInput);
    }

    if (!fileToUpload) return imageInput;

    // Compress image before uploading (Max 500px for avatars, 1000px for general uploads)
    const maxDimension = folder === 'avatars' ? 500 : 1000;
    try {
        fileToUpload = await compressImage(fileToUpload, maxDimension, 0.75);
    } catch (compressErr) {
        console.warn('Compresión previa omitida:', compressErr);
    }

    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;

    const { data, error } = await supabase.storage
        .from('uploads')
        .upload(fileName, fileToUpload, {
            contentType: 'image/jpeg',
            cacheControl: '31536000', // 1 year browser cache
            upsert: true
        });

    if (error) {
        console.error('Supabase Storage upload failed:', error);
        throw new Error(`Storage upload error: ${error.message}. Ensure "uploads" bucket exists and is set to Public.`);
    }

    const { data: publicUrlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
}

/**
 * Processes HTML content (e.g. from ReactQuill editor) and replaces any embedded
 * base64 image tags (<img src="data:image/...">) with Supabase Storage public URLs.
 * @param {string} html 
 * @param {string} folder 
 * @returns {Promise<string>} HTML string with base64 images uploaded and replaced
 */
export async function processHtmlImages(html, folder = 'cases') {
    if (!html || typeof html !== 'string' || !html.includes('data:image')) {
        return html;
    }

    const regex = /src=["'](data:image\/[a-zA-Z0-9+]+;base64,[^"']+)["']/g;
    let match;
    let updatedHtml = html;
    const matches = [];

    while ((match = regex.exec(html)) !== null) {
        if (match[1]) matches.push(match[1]);
    }

    for (const base64Data of matches) {
        try {
            const publicUrl = await uploadImageToStorage(base64Data, folder);
            if (publicUrl) {
                updatedHtml = updatedHtml.split(base64Data).join(publicUrl);
            }
        } catch (err) {
            console.error('Error uploading embedded image from HTML editor to Storage:', err);
        }
    }

    return updatedHtml;
}
