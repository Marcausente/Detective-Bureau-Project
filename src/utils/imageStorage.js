import { supabase } from '../supabaseClient';

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
 * Uploads an image (File, Blob, or Base64 DataURL) to Supabase Storage
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
    let fileExt = 'jpg';

    if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
        fileToUpload = dataURLtoBlob(imageInput);
        const match = imageInput.match(/data:image\/(.*?);/);
        if (match && match[1]) {
            fileExt = match[1] === 'jpeg' ? 'jpg' : match[1];
        }
    } else if (imageInput instanceof File) {
        fileExt = imageInput.name.split('.').pop() || 'jpg';
    }

    if (!fileToUpload) return imageInput;

    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { data, error } = await supabase.storage
        .from('uploads')
        .upload(fileName, fileToUpload, {
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
            cacheControl: '3600',
            upsert: true
        });

    if (error) {
        console.error('Supabase Storage upload failed. Make sure the "uploads" bucket exists and is public in Supabase Dashboard.', error);
        throw new Error(`Storage upload error: ${error.message}. Ensure "uploads" bucket exists and is set to Public.`);
    }

    const { data: publicUrlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
}
