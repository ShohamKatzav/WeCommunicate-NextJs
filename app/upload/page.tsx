'use client';

import { type PutBlobResult } from '@vercel/blob';
import { upload } from '@vercel/blob/client';
import { useState, useRef, useEffect } from 'react';
import { useUser } from '../hooks/useUser';

export default function AvatarUploadPage() {
    const inputFileRef = useRef<HTMLInputElement>(null);
    const [blob, setBlob] = useState<PutBlobResult | null>(null);
    const { user } = useUser();
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!user?.token) {
            setError('User not authenticated');
            return;
        }

        if (!inputFileRef.current?.files || inputFileRef.current.files.length === 0) {
            setError('Please select a file');
            return;
        }

        const file = inputFileRef.current.files[0];
        // Optional: Validate file type and size
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mp3', 'audio/mpeg'];
        if (!validTypes.includes(file.type)) {
            setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
            return;
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            setError('File size must be less than 5MB');
            return;
        }

        try {
            setIsUploading(true);
            const newBlob = await upload(file.name, file, {
                access: 'public',
                handleUploadUrl: '/api/chat/send-file',
                headers: {
                    email: user.email!,
                    authorization: `Bearer ${user.token}`
                }
            });

            setBlob(newBlob);

            // Optional: Reset the form
            if (inputFileRef.current) {
                inputFileRef.current.value = '';
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
            console.error(err);
        } finally {
            setIsUploading(false);
        }
    };

    if (!user) {
        return <div>Please log in to upload an avatar</div>;
    }

    return (
        <div>
            <h1>Upload Your Avatar</h1>

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="avatar-file">Choose an avatar image:</label>
                    <input
                        id="avatar-file"
                        name="file"
                        ref={inputFileRef}
                        type="file"
                        accept="image/*,audio/*"
                        required
                        disabled={isUploading}
                    />
                </div>
                <button type="submit" disabled={isUploading}>
                    {isUploading ? 'Uploading...' : 'Upload'}
                </button>
            </form>

            {error && (
                <div role="alert" style={{ color: 'red', marginTop: '1rem' }}>
                    {error}
                </div>
            )}

            {blob && (
                <div style={{ marginTop: '1rem' }}>
                    <p>Upload successful!</p>
                    <p>
                        Blob url: <a href={blob.url} target="_blank" rel="noopener noreferrer">{blob.url}</a>
                    </p>
                    {blob.url && <img src={blob.url} alt="Uploaded avatar" style={{ maxWidth: '200px', marginTop: '0.5rem' }} />}
                </div>
            )}
        </div>
    );
}